// UNIT test: modules/add.test.ts ↔ modules/add.ts and modules/remove.ts — the
// manifest edit, which is what installing a module IS. Mounting is somebody
// else's job, so `reload` is stubbed: a stub is one assignment into the registry
// here, exactly like a hot-swap.
import { test, expect } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { testCtx } from "../../$test";

const ROOT = resolve(import.meta.dir, "..", "..", "..", "test-proc");

async function workspace(manifest: any): Promise<{ ctx: Context; file: string }> {
    const dir = mkdtempSync(join(tmpdir(), "modules-add-"));
    const file = join(dir, "workspace.json");
    writeFileSync(file, JSON.stringify(manifest, null, 2));
    const ctx = await testCtx({ root: ROOT, workdir: dir, env: { PROCS_PATH: "./modules" } });
    // What a mounted module looks like to add/remove — nothing here is fetched.
    (ctx.state.registry as any).procs.modules.reload = () => [{ name: "labs", provides: [] }];
    return { ctx, file };
}

test("add writes `modules`, and folds a pre-rename `plugins` into it", async () => {
    // Regression: add wrote whichever key the file already had, so a workspace
    // written before the rename kept growing a `plugins` list that everything
    // reading `modules` ignored — mounting a module never started its service.
    const { ctx, file } = await workspace({ plugins: { greeter: {} } });
    await ctx.fns.procs.modules.add({ name: "labs", path: "./tools/labs" });

    const written = JSON.parse(readFileSync(file, "utf8"));
    expect(written).toEqual({ modules: { greeter: {}, labs: { path: "./tools/labs" } } });
    expect(written.plugins).toBeUndefined();
    rmSync(join(file, ".."), { recursive: true, force: true });
});

test("remove drops a module declared under the old key, and leaves one list", async () => {
    const { ctx, file } = await workspace({ plugins: { greeter: {}, labs: {} } });
    await ctx.fns.procs.modules.remove({ name: "labs" });

    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ modules: { greeter: {} } });
    await expect(ctx.fns.procs.modules.remove({ name: "labs" })).rejects.toThrow(/not declared/);
    rmSync(join(file, ".."), { recursive: true, force: true });
});
