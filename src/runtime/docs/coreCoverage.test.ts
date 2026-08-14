import { test, expect } from "bun:test";
import { testCtx } from "../../$test";

const ctx = await testCtx();

test("every core runtime function exposes documentation and parameter metadata", () => {
    const core: any = ctx.fns.procs.modules.list({}).find((item: any) => item.self);
    expect(core).toBeTruthy();
    for (const name of [...new Set(core.fns)] as string[]) {
        const meta = ctx.fns.runtime.docs.get({ name });
        expect(meta.summary || meta.doc, `${name}: missing function documentation`).toBeTruthy();
        expect(meta.paramsSchema, `${name}: missing parameter metadata`).toBeDefined();
        expect(meta.returnType, `${name}: missing return type metadata`).toBeTruthy();
        expect(meta.rel, `${name}: missing source location`).toBeTruthy();
    }
});
