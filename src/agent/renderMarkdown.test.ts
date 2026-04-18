import { test, expect, describe } from "bun:test";
import renderMarkdown from "./renderMarkdown";
import highlight from "./highlight";

const ctx = { fns: { agent: { highlight } } } as unknown as Context;

describe("agent.renderMarkdown", () => {
    test("basic markdown → HTML", async () => {
        const html = await renderMarkdown(ctx, "# Title\n\n**bold** and *italic*\n- one\n- two");
        expect(html).toContain("<h1>Title</h1>");
        expect(html).toContain("<strong>bold</strong>");
        expect(html).toContain("<ul>");
    });

    test("known language — shiki highlights with inline styles", async () => {
        const html = await renderMarkdown(ctx, "```js\nconst x = 42;\n```");
        expect(html).toContain("class=\"shiki github-light\"");
        expect(html).toContain("style=\"color:");
        expect(html).not.toContain("<pre><code class=\"language-js\">");
    });

    test("js alias → javascript", async () => {
        const html = await renderMarkdown(ctx, "```js\nlet a = 1;\n```");
        expect(html).toContain("shiki");
    });

    test("unknown language — falls back to plain code block", async () => {
        const html = await renderMarkdown(ctx, "```brainfuck\n+++.\n```");
        expect(html).toContain("<pre><code>");
        expect(html).toContain("+++.");
    });

    test("inline code stays as <code>", async () => {
        const html = await renderMarkdown(ctx, "use `Bun.file` please");
        expect(html).toContain("<code>Bun.file</code>");
    });

    test("html entities in code are decoded before highlighting", async () => {
        const html = await renderMarkdown(ctx, "```ts\nconst a: number = 1 < 2;\n```");
        expect(html).toContain("shiki");
        expect(html).toContain("1");
        expect(html).toContain("2");
    });
});
