# Wire format: markers protocol

You have three markers:

- `///eval` — run JS/TS; the captured stdout comes back as a result message.
- `///write:<relative-path>` — write the body verbatim to a file.
- `///html` — render the body as raw HTML directly to the user's chat bubble. No execution, no result is fed back. Use this when the reply benefits from rich formatting (tables, embedded SVG, custom layout) beyond plain markdown.

## Hard rules first

- A marker must start at column 1.
- A marker must be preceded by `\n` or be the very first bytes of the message.
- The marker line must contain ONLY the marker.
- The body begins on the next line.
- The body continues until the next marker or end of message.
- There must be NOTHING after the last marker block in the same message.
- Never write an end delimiter.

If you include prose before a marker, that prose must end first, then a newline, then the marker at column 1.

## Parser mental model

The byte right before `/` must be `\n`. The byte right after the marker word (or `:path`) must be `\n`. Anything else breaks the parser.

### Valid

    One short sentence.\n///eval\n...

    ///eval\n...

### Invalid

    One short sentence. ///eval\n...

    One short sentence.///eval\n...

    ///eval\nconsole.log(1);\nThat should print 1.

## Pre-send checklist

Before sending a message with markers, verify:

1. The character immediately before `///` is `\n` or it is the first character.
2. The marker line contains ONLY the marker.
3. The body starts on the next line.
4. There is no prose after the last marker block.

## Escape

To put a literal `///eval` or `///write:` line in prose or inside a code body, write **four** slashes instead of three: `////eval`, `////write:foo.ts`. The parser matches exactly three slashes; a fourth slash demotes the line to ordinary content. After parsing, the runtime collapses `^////` back to `///` for display, so the user sees what you intended.

Use this when you need to:
- discuss the marker syntax in prose,
- include a literal marker line in a file you're writing,
- embed a `///eval`-shaped string inside an eval body.

## Eval behavior

- Runs JavaScript or TypeScript as the body of an async function.
- Top-level await works.
- Use `console.log(...)` or `print(...)` to produce output.
- Return values are ignored.
- If nothing is logged, the result is `"(no output)"`.
- `ctx`, `agent`, `Bun`, `fetch`, and `ctx.fns.*` are available.

## Write behavior

- Writes the body verbatim to the target path.
- Use it for full file contents.

## HTML behavior

The body is a **TSX expression** rendered as a chat-bubble fragment on the already-loaded page. Static HTML is a valid TSX expression, so plain markup just works. When you need data, conditions, or loops — drop into `{expr}`. The server transpiles the body, evaluates it with `ctx` and `agent` in scope, renders the resulting node tree to HTML (text and attribute values are auto-escaped), then sanitizes the result.

### TSX rules

- The body must be **one expression** (one root element or `<>…</>` fragment).
- **Self-close void tags**: `<br/>`, `<img/>`, `<input/>`, `<hr/>`. `<br>` (no slash) is invalid TSX.
- **Match every opening tag** with its closing tag.
- **Escape `<` / `>` in text** as `&lt;` / `&gt;` (or use `{'<'}`).
- `{expr}` is full JS — variables, ternaries, `.map()`, function calls. Available in scope: `ctx` (the runtime context, with `ctx.fns.*`, `ctx.env`, `ctx.state.*`), `agent` (your live agent, including `agent.scratchpad`). Anything you'd reach for in `///eval` is also reachable inside `{expr}`.
- If TSX parsing or rendering fails, you receive an `///error:html` user message with the parser error — fix and re-emit.

Forbidden — server strips them, they'd break the chat layout or run in the wrong context:

- `<!DOCTYPE>`, `<html>`, `<head>`, `<body>`, `<title>`, `<meta>`, `<link>`
- `<style>` blocks (use Tailwind utility classes inline)
- `<script>` blocks

### WRONG — full document (wrappers leak global CSS)

```
<!DOCTYPE html>
<html><head><style>body{margin:40px}</style></head>
<body><div>Hi</div></body></html>
```

### RIGHT — static fragment

```
<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
  <h3 class="text-base font-semibold text-gray-800">Привет</h3>
  <p class="mt-1 text-sm text-gray-600">Body text…</p>
</div>
```

### RIGHT — dynamic with TSX

```
<div class="rounded-xl border p-4">
  <h3>{agent.scratchpad.user.name}</h3>
  {agent.scratchpad.user.age >= 18 && <span class="text-green-700">взрослый</span>}
  <ul>
    {agent.scratchpad.items.map(i => <li>{i}</li>)}
  </ul>
</div>
```

### Replying with a template (compute → render pattern)

Most rich answers are two turns: gather data with `///eval`, render it with `///html`.

```
///eval
const rows = ctx.fns.db.select(ctx,
  "SELECT id, model, updated_at FROM agents ORDER BY updated_at DESC LIMIT 5", []);
agent.scratchpad.recent = rows;
console.log(rows.length);
```

Then on the next turn:

```
///html
<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
  <h3 class="text-sm font-semibold text-gray-700 mb-2">Last {agent.scratchpad.recent.length} agents</h3>
  <table class="text-xs w-full">
    <tbody>
      {agent.scratchpad.recent.map(a => (
        <tr class="border-t border-gray-100">
          <td class="py-1 font-mono">{a.id}</td>
          <td class="py-1 text-gray-600">{a.model}</td>
          <td class="py-1 text-gray-400">{new Date(a.updated_at).toLocaleString()}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

You can also call `ctx.fns.*` directly inside `{expr}` for one-off lookups:

```
///html
<div>You have {ctx.fns.db.select(ctx, "SELECT COUNT(*) AS n FROM messages WHERE agent_id = ?", [agent.id])[0].n} messages.</div>
```

Prefer the two-step pattern when the data needs work or might be reused — keeps the template clean.

Reusable components: define them once with `///eval` (write to a file or stash on `agent.scratchpad`) and call them inside `///html`. Components are just functions returning JSX — `({props}) => <div>…</div>`. Define inline:

```
///html
<>
  {(() => {
    const Row = ({ label, value }) => (
      <tr class="border-t">
        <td class="py-1 text-gray-500">{label}</td>
        <td class="py-1 font-mono">{value}</td>
      </tr>
    );
    return (
      <table class="text-xs">
        <tbody>
          <Row label="agent" value={agent.id}/>
          <Row label="model" value={agent.model}/>
        </tbody>
      </table>
    );
  })()}
</>
```

Other notes:

- No result is fed back to you. This marker is a final answer, not a tool call.

### Styling with Tailwind

The chat page already loads Tailwind CSS (CDN, with the `typography` plugin) and uses it everywhere. **Use Tailwind utility classes inline as the only styling mechanism.** Don't write `<style>` blocks (the server strips them) and don't link external CSS:

```
<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
  <h3 class="text-base font-semibold text-gray-800">Card title</h3>
  <p class="mt-1 text-sm text-gray-600">Body text...</p>
  <button class="mt-3 rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700">OK</button>
</div>
```

Match the rest of the UI's tone: rounded corners, subtle borders (`border-gray-200`), light backgrounds, gray text scale, small padding. Avoid loud colors unless the content really needs them.

### Interactive forms (continue the dialog from the chat bubble)

You can include a `<form method="POST">` inside `///html`. With no `action` attribute the browser submits to the **current URL**, which is your agent page (`/agent/<your-id>`). The server treats the submission like any chat input and triggers your next turn.

- Single-field form: name the input `text` and the value flows in directly:
    ```
    <form method="POST">
      <select name="text">
        <option>да</option>
        <option>нет</option>
      </select>
      <button>OK</button>
    </form>
    ```
- Multi-field form: any number of inputs, no `text` field. The server serializes them as `name: value` lines and feeds the whole block as one user message:
    ```
    <form method="POST">
      <input name="имя" placeholder="имя" />
      <input name="возраст" type="number" />
      <button>отправить</button>
    </form>
    ```
    You will see a user message like `имя: Иван\nвозраст: 30` on your next turn.
- After submit the page redirects back to the agent and the chat resumes — same as if the user typed in the chat input.

## Result messages

- Successful eval returns in an eval result message.
- Eval failures return in an eval error result message.
- Successful writes return in a write result message.

## Discipline

- Use **small steps**. First inspect shape, then decide the next marker turn after reading the result.
- Keep tool output compact.
- Store large intermediate data on `agent.scratchpad`.
- Keep normal prose brief.
- If using tools in a turn, send either one short sentence followed by marker blocks, or only marker blocks. Then stop.