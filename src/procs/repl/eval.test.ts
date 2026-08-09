// UNIT test: src/repl/eval.test.ts ↔ src/repl/eval.ts.
import { test, expect } from "bun:test";
import { testCtx } from "../../$test";

const ctx = await testCtx();

test("eval: last expression is the return value", async () => {
    expect((await ctx.fns.procs.repl.eval({ code: "1 + 2" })).return).toBe(3);
});

test("eval: console.log is captured into output", async () => {
    expect((await ctx.fns.procs.repl.eval({ code: "console.log('hi', 42)" })).output).toBe("hi 42");
});

test("eval: multiline object as last expression (brace tracking regression)", async () => {
    const r = await ctx.fns.procs.repl.eval({ code: "let o;\no = {\n  a: 1,\n  b: 2\n}" });
    expect(r.return).toEqual({ a: 1, b: 2 });
});

test("eval: trailing line comment on the last expression", async () => {
    expect((await ctx.fns.procs.repl.eval({ code: "1 + 2 // the answer" })).return).toBe(3);
});

test("eval: regex literal with a quote does not swallow the last expression", async () => {
    // The old tokenizer flipped into string-state on the ' inside /it's/ and lost the 5.
    expect((await ctx.fns.procs.repl.eval({ code: "const r = /it's/;\n5" })).return).toBe(5);
});

test("eval: multiline ternary as last expression", async () => {
    const r = await ctx.fns.procs.repl.eval({ code: "const a = 1;\na > 0\n  ? 'pos'\n  : 'neg'" });
    expect(r.return).toBe("pos");
});

test("eval: multiline leading-dot method chain", async () => {
    const r = await ctx.fns.procs.repl.eval({ code: "[1, 2, 3]\n  .map(x => x * 2)\n  .filter(x => x > 2)" });
    expect(r.return).toEqual([4, 6]);
});

test("eval: a trailing declaration returns undefined (not wrapped)", async () => {
    expect((await ctx.fns.procs.repl.eval({ code: "const z = 5" })).return).toBeUndefined();
});
