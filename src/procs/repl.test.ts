// FUNCTIONAL test: src/procs/repl.test.ts ↔ the procs/repl/ namespace — the door
// every agent drives this process through. What is tested here is the *answer to
// a failure*: the REPL is the only thing that speaks when something goes wrong,
// so a message that is true and useless costs a whole detour.
import { test, expect } from "bun:test";
import { testCtx } from "../$test";

const ctx = await testCtx();

// The one that keeps happening: a file is written, the function it declares is
// called in the same breath, and the answer is `undefined is not an object` —
// every word true, none of it saying that the process has not read the file yet.
test("a missing name explains itself", () => {
    const gone = ctx.fns.procs.repl.explain({ error: new TypeError("undefined is not an object (evaluating 'ctx.fns.footcheck.register')") });
    expect(gone).toContain("no module called `footcheck`");
    expect(gone).toContain("dev.doc");

    // A module that IS mounted, missing one function: say what it does have.
    const partial = ctx.fns.procs.repl.explain({ error: new TypeError("undefined is not an object (evaluating 'ctx.fns.procs.nonesuch')") });
    expect(partial).toContain("`procs` is mounted and has no `nonesuch`");

    // Anything else is left alone rather than guessed at: a wrong hint costs
    // more than none.
    expect(ctx.fns.procs.repl.explain({ error: new Error("aidbox 422 /fhir/Patient") })).toBeNull();
    // …and a function that exists but threw from inside is not a naming problem.
    expect(ctx.fns.procs.repl.explain({ error: new TypeError("undefined is not an object (evaluating 'ctx.fns.procs.repl.explain')") })).toBeNull();
});
