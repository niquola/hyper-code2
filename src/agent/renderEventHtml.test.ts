import { describe, test, expect } from "bun:test";
import renderEventHtmlFn from "./renderEventHtml";
import toolMeta from "./toolMeta";

// The renderer asks the registry how a tool presents itself, so the stub ctx
// carries the real fn rather than a fake one — the icon/label/subject table is
// exactly what these assertions are about.
const ctx = { fns: { agent: { toolMeta: (opts: any) => toolMeta(ctx, null, opts) } } } as unknown as Context;
const renderEventHtml = (c: any, event: any, opts: { agentId?: string } = {}) =>
    renderEventHtmlFn(c, null, { event, agentId: opts.agentId });

describe("agent.renderEventHtml", () => {
  test("renders a tool call as a card that names what it acted on", async () => {
    // The card says the verb and the SUBJECT — "eval 1 + 1", not "args 63c".
    const evalHtml = await renderEventHtml(ctx, { type: "tool_call", name: "eval", argsHtml: "<pre>a</pre>", resultHtml: "<pre>b</pre>", result: "b", args: { code: "1 + 1" }, isError: false, ts: Date.now() });
    expect(evalHtml).toContain("<details");
    expect(evalHtml).toContain(">eval<");
    expect(evalHtml).toContain("1 + 1");
    expect(evalHtml).toContain("ph-brackets-curly");
    expect(evalHtml).toContain("<pre>a</pre>");
    expect(evalHtml).toContain("<pre>b</pre>");

    // A write names its path and opens by default — the body is the point —
    // but it is NOT pinned: only a failure escapes the aging timers.
    const writeHtml = await renderEventHtml(ctx, { type: "tool_call", name: "write", argsHtml: "<pre>x</pre>", resultHtml: "<pre>ok</pre>", result: "ok", args: { path: "src/foo.ts", content: "x" }, isError: false, ts: Date.now() });
    expect(writeHtml).toContain("src/foo.ts");
    expect(writeHtml).toContain("<details open");
    expect(writeHtml).not.toContain('data-pinned');

    const failed = await renderEventHtml(ctx, { type: "tool_call", name: "bash", args: { command: "false" }, result: "[exit 1]", argsHtml: "", resultHtml: "", isError: true, ts: Date.now() - 60_000 });
    expect(failed).toContain('data-pinned="1"');
    expect(failed).not.toContain("tool-tucked");

    // An old call arrives already tucked, so reloading a long transcript does
    // not flash a hundred expanded cards.
    for (const name of ["read", "write"]) {
        const old = await renderEventHtml(ctx, { type: "tool_call", name, args: { path: "a.ts" }, result: "x", argsHtml: "", resultHtml: "", isError: false, ts: Date.now() - 60_000 });
        expect(old).toContain("tool-tucked");
        expect(old).not.toContain("<details open");
    }

    // Errors stay open too so the user sees the failure body without a click.
    const errHtml = await renderEventHtml(ctx, { type: "tool_call", name: "eval", argsHtml: "<pre>x</pre>", resultHtml: "<pre>err</pre>", result: "err", args: { code: "x" }, isError: true });
    expect(errHtml).toContain("<details open");

    // Unknown / legacy event names fall through to the raw name.
    const legacy = await renderEventHtml(ctx, { type: "tool_call", name: "evalCode", argsHtml: "<pre>a</pre>", resultHtml: "<pre>b</pre>", result: "b", args: { code: "a" }, isError: false });
    expect(legacy).toContain("evalCode");
  });

  test("renders assistant as left bubble with htmx delete buttons when agentId given", async () => {
    const html = await renderEventHtml(ctx, { type: "assistant", html: "<p>ok</p>", usage: { prompt_tokens: 1234, total_tokens: 1300 }, messageIdx: 7 }, { agentId: 'a1' });
    expect(html).toContain("justify-start");
    expect(html).toContain("rounded-2xl bg-gray-50");
    expect(html).toContain("prose prose-sm max-w-none");
    expect(html).toContain(`hx-post="/agent/a1/messages/delete"`);
    expect(html).toContain(`"idx":"7"`);
    expect(html).toContain(`hx-confirm="delete this message?"`);
  });

  test("assistant: balanced rendered html passes through verbatim", async () => {
    const balanced = '<p>line 1</p><p>line 2</p>';
    const out = await renderEventHtml(ctx, { type: "assistant", html: balanced, text: 'line 1\nline 2', messageIdx: 1 });
    expect(out).toContain(balanced);
    expect(out).not.toContain('<pre class="text-xs whitespace-pre-wrap');
  });

  test("assistant: unbalanced rendered html falls back to escaped <pre> (one bad bubble cannot break the page)", async () => {
    // This is the exact pattern that broke the chat page: model emitted
    // `prose.§bash` mid-line + Python heredoc content; markdown.render
    // produced an extra </div>. Without the balance-check fallback, every
    // bubble below this one renders inside the broken div tree.
    const broken = '<p>good prefix</p><div class="x">stuff</div></div>';
    const text = 'Plain prose with <<\'PY\'\nfrom pathlib import Path\nPY\n';
    const out = await renderEventHtml(ctx, { type: "assistant", html: broken, text, messageIdx: 42 });
    // The original broken html must NOT appear in the output.
    expect(out).not.toContain(broken);
    // Instead, plain text wrapped in <pre> with HTML-escaped content.
    expect(out).toContain('<pre class="text-xs whitespace-pre-wrap');
    expect(out).toContain('&lt;&lt;&#39;PY&#39;');
    expect(out).toContain('from pathlib import Path');
  });

  test("assistant: missing html falls back to escaped <p> (existing behaviour)", async () => {
    const out = await renderEventHtml(ctx, { type: "assistant", text: 'hello & world', messageIdx: 0 });
    expect(out).toContain('<p>hello &amp; world</p>');
  });

  test("renders user with htmx delete + 'from here' buttons", async () => {
    const html = await renderEventHtml(ctx, { type: "user", text: "hi", messageIdx: 3 }, { agentId: 'a1' });
    expect(html).toContain("justify-end");
    expect(html).toContain("bg-gray-900");
    expect(html).toContain(`"mode":"one"`);
    expect(html).toContain(`"mode":"from"`);
    expect(html).toContain(`hx-confirm="delete this and everything after?"`);
  });

  test("omits delete controls when agentId not provided (e.g. test stubs)", async () => {
    const html = await renderEventHtml(ctx, { type: "user", text: "hi", messageIdx: 3 });
    expect(html).not.toContain("hx-post");
  });
});
