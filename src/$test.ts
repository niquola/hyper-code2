// Test harness — skipped by the scanner (stem "$test" is reserved), so it's
// never registered. Co-locate tests as src/<module>/<name>.test.ts and run
// `bun test` (or ctx.fns.procs.dev.test from the REPL). Each test gets a real ctx
// with the full registry loaded but NO server/watcher:
//
//   import { test, expect } from "bun:test";
//   import { testCtx } from "../$test";
//   const ctx = await testCtx();
//   test("fib", async () => {
//     expect(await ctx.fns.math.fib({ n: 10 })).toEqual({ n: 10, fib: 55 });
//   });
import { resolve } from "node:path";
import { makeCtx, makeRequestCtx } from "./$main";
import loadFns from "./procs/boot/load";

// Fresh ctx per call → test files don't leak ctx.state into each other.
// Registry + routes loaded (so ctx.fns.procs.http.dispatch can match), NODE_ENV=test
// (so ctx.fns.procs.env.pick returns test config, e.g. an in-memory db), and NO
// server is started. loadFns/loadRoutes are cheap; we silence the load chatter.
export async function testCtx(opts?: { root?: string; workdir?: string; env?: Record<string, string> }): Promise<Context> {
    const ctx = makeCtx();
    // Default root = THIS repo (this file lives in src/). Without it projectRoot
    // falls back to src/procs/../.. = src, and genTypes/discover look in src/src.
    ctx.state.root = opts?.root ?? resolve(import.meta.dir, "..");
    // Per-ctx, never through process.env: two test files that each need their own
    // project would otherwise fight over one global, and the loser mounts the
    // wrong thing (this is exactly what happened).
    if (opts?.workdir) ctx.env.WORKDIR = opts.workdir;
    Object.assign(ctx.env, opts?.env ?? {});
    ctx.env.NODE_ENV = "test";
    ctx.env.DATABASE_URL = ":memory:"; // test db, via config (env enters through config)
    // Boot chatter is `log.debug` and the default level is info, so a test run is
    // quiet without anyone muzzling console.log. LOG_LEVEL=debug shows it all.
    ctx.env.LOG_LEVEL ??= "warn";
    await loadFns(ctx, null, {});
    await ctx.fns.procs.http.loadRoutes({});
    await ctx.fns.procs.migrate.up({});
    return ctx;
}

// Request-scoped ctx + session, for testing route handlers / things that read
// the session (params, req). Anything it calls via ctx.fns.* sees this session.
export function reqCtx(ctx: Context, opts?: { params?: Record<string, string>; req?: Request }): Context {
    return makeRequestCtx(ctx, { kind: "test", params: opts?.params ?? {}, req: opts?.req });
}
