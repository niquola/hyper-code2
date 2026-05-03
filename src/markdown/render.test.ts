import { test, expect, describe, mock } from "bun:test";
import render from "./render";
import highlight from "./highlight";

describe("markdown.render", () => {
    test("basic markdown → HTML", async () => {
        const ctx = { fns: { markdown: { highlight, mermaid: async () => "" } } } as unknown as Context;
        const html = await render(ctx, { source: "# Title\n\n**bold** and *italic*\n- one\n- two" });
        expect(html).toContain("<h1>Title</h1>");
        expect(html).toContain("<strong>bold</strong>");
        expect(html).toContain("<ul>");
    });

    test("code block gets shiki-highlighted", async () => {
        const ctx = { fns: { markdown: { highlight, mermaid: async () => "" } } } as unknown as Context;
        const html = await render(ctx, { source: "```js\nconst x = 42;\n```" });
        expect(html).toContain("class=\"shiki github-light\"");
        expect(html).toContain("style=\"color:");
        expect(html).not.toContain("<pre><code class=\"language-js\">");
    });

    test("inline code stays as <code>", async () => {
        const ctx = { fns: { markdown: { highlight, mermaid: async () => "" } } } as unknown as Context;
        const html = await render(ctx, { source: "use `Bun.file` please" });
        expect(html).toContain("<code>Bun.file</code>");
    });

    test("unknown language falls back to plain code", async () => {
        const ctx = { fns: { markdown: { highlight, mermaid: async () => "" } } } as unknown as Context;
        const html = await render(ctx, { source: "```brainfuck\n+++.\n```" });
        expect(html).toContain("<pre><code>");
        expect(html).toContain("+++.");
    });

    test("html entities inside code are decoded before highlighting", async () => {
        const ctx = { fns: { markdown: { highlight, mermaid: async () => "" } } } as unknown as Context;
        const html = await render(ctx, { source: "```ts\nconst a: number = 1 < 2;\n```" });
        expect(html).toContain("shiki");
        expect(html).toContain("1");
        expect(html).toContain("2");
    });

    test("mermaid blocks are pre-rendered before markdown html", async () => {
        const mermaid = mock(async (_ctx: Context, opts: { source: string }) => {
            return "<div class=\"mermaid-diagram\" data-code=\"" + opts.source.replace(/"/g, "&quot;") + "\"><svg></svg></div>";
        });
        const ctx = { fns: { markdown: { highlight, mermaid } } } as unknown as Context;
        const html = await render(ctx, { source: ["# Diagram", "", "```mermaid", "flowchart LR", "A --> B", "```"].join("\n") });
        expect(mermaid).toHaveBeenCalledTimes(1);
        expect(html).toContain("class=\"mermaid-diagram\"");
        expect(html).toContain("<svg></svg>");
        expect(html).not.toContain("language-mermaid");
    });

    test("mermaid render failure falls back to plain code block", async () => {
        const mermaid = mock(async () => { throw new Error("boom"); });
        const ctx = { fns: { markdown: { highlight, mermaid } } } as unknown as Context;
        const html = await render(ctx, { source: ["```mermaid", "flowchart LR", "A --> B", "```"].join("\n") });
        expect(html).toContain("<pre><code>");
        expect(html).toContain("flowchart LR");
        expect(html).toContain("A --&gt; B");
    });
});
