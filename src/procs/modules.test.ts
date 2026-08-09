// FUNCTIONAL test: src/modules.test.ts ↔ the src/procs/modules/ namespace —
// specifically the one rule a clinical host stands on: a **folder of installed
// projects**. `"path": [… , "./apps/*"]` mounts everything under that directory,
// each project under its own folder name, so two projects that both ship
// `patients/` stay apart instead of becoming one namespace.
import { test, expect, beforeAll, afterAll } from "bun:test";
import { testCtx } from "../$test";
import { rm } from "node:fs/promises";

const HOST = `${process.env.TMPDIR ?? "/tmp"}/procs-apps-${Bun.hash("apps-host")}`;

beforeAll(async () => {
    await Bun.write(`${HOST}/package.json`, JSON.stringify({ name: "host", procs: { path: ["./apps/*"], prod: {} } }));
    await Bun.write(`${HOST}/src/.keep`, "");
    for (const app of ["alpha", "beta"]) {
        await Bun.write(`${HOST}/apps/${app}/package.json`, JSON.stringify({ name: app, procs: { src: "src" } }));
        // both ship the same namespace and the same route — the collision the
        // prefix exists for.
        await Bun.write(`${HOST}/apps/${app}/src/patients/list.ts`,
            `export default function (_ctx: Context, _s: Session | null, _o: {}) { return "${app}"; }\n`);
        await Bun.write(`${HOST}/apps/${app}/src/patients/$route__GET.ts`,
            `export default function (ctx: Context) { return ctx.fns.${app}.patients.list({}); }\n`);
    }
});

afterAll(async () => { await rm(HOST, { recursive: true, force: true }); });

test("a folder of projects mounts each under its own name", async () => {
    const ctx = await testCtx({ root: HOST, workdir: HOST });

    // Both are mounted, neither had to be named in the composition list.
    const mounted = ctx.state.procs.modules.map((m: any) => m.name).filter((n: string) => n === "alpha" || n === "beta");
    expect(mounted.sort()).toEqual(["alpha", "beta"]);

    // Each keeps its own copy of the same namespace…
    const fns = ctx.fns as any;   // the fixtures are not in this app's generated types
    expect(fns.alpha.patients.list({})).toBe("alpha");
    expect(fns.beta.patients.list({})).toBe("beta");

    // …and its own route, rather than one of them silently winning.
    expect(await (await ctx.fns.procs.http.dispatch({ url: "/alpha/patients" })).text()).toContain("alpha");
    expect(await (await ctx.fns.procs.http.dispatch({ url: "/beta/patients" })).text()).toContain("beta");
});
