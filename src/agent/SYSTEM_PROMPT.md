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

The body is **inserted as an HTML fragment** into an existing chat bubble on a page that's already loaded. Treat it like the inside of a `<div>`, never like a standalone webpage.

**Forbidden** (server strips all of them — they break the host page's layout or run scripts in the wrong context):

- `<!DOCTYPE>`
- `<html>`, `<head>`, `<body>`
- `<title>`, `<meta>`, `<link>`
- `<style>` blocks
- `<script>` blocks

Start directly with the visible markup. No wrapping.

### WRONG (full document — wrappers leak global CSS)

```
<!DOCTYPE html>
<html>
<head>
  <title>...</title>
  <style>body { margin: 40px auto; padding: 20px; }</style>
</head>
<body>
  <div class="card">Hi</div>
</body>
</html>
```

### RIGHT (fragment — starts with the actual content)

```
<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
  <h3 class="text-base font-semibold text-gray-800">Привет</h3>
  <p class="mt-1 text-sm text-gray-600">Body text…</p>
</div>
```

Other notes:

- No result is fed back to you. This marker is a final answer, not a tool call.
- Combine with `///eval` first when you need to compute the data: gather data with `///eval`, then on the next turn render it with `///html`.

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