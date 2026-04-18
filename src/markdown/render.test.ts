import { test, expect, describe } from "bun:test";
import render from "./render";
import highlight from "./highlight";

const ctx = { fns: { markdown: { highlight } } } as unknown as Context;

describe("markdown.render", () => {
    test("basic markdown → HTML", async () => {
        const html = await render(ctx, "# Title\n\n**bold** and *italic*\n- one\n- two");
        expect(html).toContain("<h1>Title</h1>");
        expect(html).toContain("<strong>bold</strong>");
        expect(html).toContain("<ul>");
    });

    test("code block gets shiki-highlighted", async () => {
        const html = await render(ctx, "```js\nconst x = 42;\n```");
        expect(html).toContain("class=\"shiki github-light\"");
        expect(html).toContain("style=\"color:");
        expect(html).not.toContain("<pre><code class=\"language-js\">");
    });

    test("inline code stays as <code>", async () => {
        const html = await render(ctx, "use `Bun.file` please");
        expect(html).toContain("<code>Bun.file</code>");
    });

    test("unknown language falls back to plain code", async () => {
        const html = await render(ctx, "```brainfuck\n+++.\n```");
        expect(html).toContain("<pre><code>");
        expect(html).toContain("+++.");
    });

    test("html entities inside code are decoded before highlighting", async () => {
        const html = await render(ctx, "```ts\nconst a: number = 1 < 2;\n```");
        expect(html).toContain("shiki");
        expect(html).toContain("1");
        expect(html).toContain("2");
    });
});
