import { test, expect, describe } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("session.list", () => {
    test("empty → []", async () => {
        const ctx: any = await mkTestCtx();
        expect(await ctx.fns.session.list()).toEqual([]);
    });

    test("returns lightweight summaries ordered by updated_at desc", async () => {
        const ctx: any = await mkTestCtx();
        ctx.fns.agent.renderEventHtml = async (_c: any, _s: any, _o: any) => '';
        const a = await ctx.fns.agent.start({ model: "m1" });
        await ctx.fns.session.save({ agent: a });
        await ctx.fns.session.appendUserMessage({ id: a.id, text: 'first msg' });

        await new Promise(r => setTimeout(r, 5));
        const b = await ctx.fns.agent.start({ model: "m2" });
        await ctx.fns.session.save({ agent: b });

        const rows = await ctx.fns.session.list();
        expect(rows).toHaveLength(2);
        expect(rows[0]!.id).toBe(b.id);         // newest first
        expect(rows[1]!.id).toBe(a.id);
        expect(rows[1]!.title).toBe("first msg");
        expect(rows[0]!.title).toBe("(empty)");
        expect(rows[0]!.model).toBe("m2");
    });
});
