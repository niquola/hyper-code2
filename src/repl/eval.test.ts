import { test, expect, describe } from "bun:test";
import evalFn from "./eval";

describe("repl.eval (Jupyter-style: console.log captures output)", () => {
    const ctx = { foo: "bar" } as unknown as Context;

    test("nothing logged → '(no output)'", async () => {
        expect(await evalFn(ctx, { code: "1 + 1" })).toBe("(no output)");
    });

    test("console.log of a number", async () => {
        expect(await evalFn(ctx, { code: "console.log(1 + 1)" })).toBe("2");
    });

    test("console.log of a string is verbatim", async () => {
        expect(await evalFn(ctx, { code: "console.log('hello')" })).toBe("hello");
    });

    test("console.log of an object pretty-prints via Bun.inspect", async () => {
        const out = await evalFn(ctx, { code: "console.log({ x: 4, y: 'a' })" });
        expect(out).toContain("x: 4");
        expect(out).toContain("y: \"a\"");
    });

    test("multiple log calls produce one line each, preserving order", async () => {
        const out = await evalFn(ctx, { code: "console.log('one'); console.log('two'); console.log(3)" });
        expect(out).toBe("one\ntwo\n3");
    });

    test("`print` is an alias for console.log", async () => {
        expect(await evalFn(ctx, { code: "print('hi'); print(42)" })).toBe("hi\n42");
    });

    test("await works at top level", async () => {
        expect(await evalFn(ctx, { code: "const r = await Promise.resolve(42); console.log(r)" })).toBe("42");
    });

    test("ctx is bound", async () => {
        expect(await evalFn(ctx, { code: "console.log(ctx.foo)" })).toBe("bar");
    });

    test("TypeScript with type annotations is transpiled", async () => {
        const out = await evalFn(ctx, { code: "const x: number = 5; const y: string = 'a'; console.log(x + y.length);" });
        expect(out).toBe("6");
    });

    test("TypeScript interface declarations transpile away", async () => {
        const out = await evalFn(ctx, { code: `
            interface User { name: string; age: number; }
            const u: User = { name: 'a', age: 1 };
            console.log(u.name);
        ` });
        expect(out).toBe("a");
    });

    test("throws on reference error", async () => {
        await expect(evalFn(ctx, { code: "console.log(nonExistent.boom())" })).rejects.toThrow(/not defined/);
    });

    test("extra bindings are exposed by name", async () => {
        const agent: any = { id: "a1", messages: [] };
        const result = await evalFn(ctx, { code: "console.log(agent.id)", agent });
        expect(result).toBe("a1");
    });

    test("bindings can be mutated", async () => {
        const agent: any = { messages: [] as any[] };
        await evalFn(ctx, { code: "agent.messages.push({role:'user', content:'x'}); console.log(agent.messages.length);", agent });
        expect(agent.messages.length).toBe(1);
    });

    test("console.error also goes to the same buffer", async () => {
        expect(await evalFn(ctx, { code: "console.error('oops')" })).toBe("oops");
    });
});
