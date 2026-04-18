import { test, expect, describe } from "bun:test";
import highlight from "./highlight";

const ctx = {} as Context;

describe("markdown.highlight", () => {
    test("known language — shiki output with inline colors", async () => {
        const html = await highlight(ctx, "const x = 1;", "js");
        expect(html).toContain("class=\"shiki github-light\"");
        expect(html).toContain("style=\"color:");
    });

    test("alias ts → typescript", async () => {
        const html = await highlight(ctx, "let a: number = 1;", "ts");
        expect(html).toContain("shiki");
    });

    test("alias sh → bash", async () => {
        const html = await highlight(ctx, "ls -la", "sh");
        expect(html).toContain("shiki");
    });

    test("unknown language — plain <pre><code> fallback, escaped", async () => {
        const html = await highlight(ctx, "1 < 2 & 3 > 0", "brainfuck");
        expect(html).toContain("<pre><code>");
        expect(html).toContain("1 &lt; 2");
        expect(html).toContain("&amp;");
    });
});
