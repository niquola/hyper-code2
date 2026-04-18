import { test, expect, describe } from "bun:test";
import evalFn from "./eval";

describe("repl.eval", () => {
    const ctx = { foo: "bar" } as unknown as Context;

    test("expression", async () => {
        expect(await evalFn(ctx, "1 + 1")).toBe(2);
    });

    test("async expression", async () => {
        expect(await evalFn(ctx, "Promise.resolve(42)")).toBe(42);
    });

    test("ctx is bound", async () => {
        expect(await evalFn(ctx, "ctx.foo")).toBe("bar");
    });

    test("statement block falls back", async () => {
        expect(await evalFn(ctx, "const x = 5; return x * 2;")).toBe(10);
    });

    test("throws on reference error", async () => {
        await expect(evalFn(ctx, "nonExistent.boom()")).rejects.toThrow(/not defined/);
    });

    test("no shortcut bindings — only ctx by default", async () => {
        await expect(evalFn(ctx, "repl")).rejects.toThrow(/repl is not defined/);
    });

    test("extra bindings are exposed by name", async () => {
        const agent = { id: "a1", messages: [] };
        const result = await evalFn(ctx, "agent.id", { agent });
        expect(result).toBe("a1");
    });

    test("bindings can be mutated", async () => {
        const agent = { messages: [] as any[] };
        await evalFn(ctx, "agent.messages.push({role:'user', content:'x'}); return agent.messages.length;", { agent });
        expect(agent.messages.length).toBe(1);
    });
});
