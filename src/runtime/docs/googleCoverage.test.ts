import { test, expect } from "bun:test";
import { testCtx } from "../../$test";

const ctx = await testCtx();

test("all mounted Google Workspace functions expose docs and parameter schemas", () => {
    const module: any = ctx.fns.procs.modules.list({}).find((item: any) => item.name === "google");
    if (!module) return; // Google is optional outside the main workspace.
    const names = [...new Set(module.fns)] as string[];
    expect(names.length).toBeGreaterThan(50);
    for (const name of names) {
        const meta = ctx.fns.runtime.docs.get({ name });
        expect(meta.summary || meta.doc, name).toBeTruthy();
        expect(meta.paramsSchema?.properties, name).toBeDefined();
    }
});
