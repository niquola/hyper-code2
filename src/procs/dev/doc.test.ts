// FUNCTIONAL test: dev.doc / dev.where ↔ the metadata the fn loader attaches.
// The image answers "what is this and where does it live" without touching disk.
import { test, expect } from "bun:test";
import { testCtx } from "../../$test";

const ctx = await testCtx();

test("dev.doc: metadata comes off the function object, not a lookup table", () => {
    const meta = ctx.fns.procs.dev.doc({ name: "procs.hooks.run" });
    expect(meta).toMatchObject({ name: "procs.hooks.run", module: "procs.hooks", fn: "run" });
    expect(meta.doc.split("\n")[0]).toContain("Run every hook registered under");

    // The same object the registry holds carries it — that IS the storage.
    const raw = (ctx.state.registry as any).procs.hooks.run;
    expect(raw.meta).toBe(meta);
});

test("dev.doc: searching the image by name or docstring", () => {
    const byName = ctx.fns.procs.dev.doc({ q: "loadroutes" }).map((m: any) => m.name);
    expect(byName).toContain("procs.http.loadRoutes");

    const byDoc = ctx.fns.procs.dev.doc({ q: "first responder" }).map((m: any) => m.name);
    expect(byDoc).toContain("procs.hooks.first");

    // Every entry is one line, so a listing stays readable.
    for (const m of ctx.fns.procs.dev.doc({ q: "hook" })) expect(m.doc).not.toContain("\n");
});

// A query is words. Matched whole, `q: "load routes"` found nothing — which
// reads as "this process has no such thing" and sends the reader to the source.
test("dev.doc: several words are several words, and near misses beat nothing", () => {
    expect(ctx.fns.procs.dev.doc({ q: "load routes" }).map((m: any) => m.name)).toContain("procs.http.loadRoutes");

    // Nothing has all of them — the ones that have some come back rather than
    // an empty list, best first.
    const near = ctx.fns.procs.dev.doc({ q: "loadRoutes unicorn" });
    expect(near.length).toBeGreaterThan(0);
    expect(near[0].name).toBe("procs.http.loadRoutes");

    // …and a word nothing has at all is still an empty answer.
    expect(ctx.fns.procs.dev.doc({ q: "zzzznotathing" })).toEqual([]);
});

test("dev.where: a name resolves to a file, and an unknown name says so", () => {
    expect(ctx.fns.procs.dev.where({ name: "procs.db.select" })).toMatchObject({
        module: "procs.db", rel: "procs/db/select.ts",
    });
    expect(() => ctx.fns.procs.dev.where({ name: "procs.db.nope" })).toThrow(/no such function/);
    expect(() => ctx.fns.procs.dev.doc({ name: "nope.nope" })).toThrow(/no such function/);
});

test("metadata survives self-binding, so a mounted module keeps it", () => {
    // bindSelf wraps a mounted module's functions; the wrapper is the function
    // as far as everyone else is concerned, so it carries the same metadata.
    const greeterLike = (ctx.state.registry as any).procs.ui.button;
    expect(greeterLike.meta.name).toBe("procs.ui.button");
});
