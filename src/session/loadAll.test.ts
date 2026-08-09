import { test, expect, describe } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("session.loadAll", () => {
    test("empty db → {loaded: 0}", async () => {
        const ctx: any = await mkTestCtx();
        expect(ctx.fns.session.loadAll().loaded).toBe(0);
    });

    test("rehydrates every saved agent into ctx.state.agent", async () => {
        const ctx: any = await mkTestCtx();
        ctx.fns.agent.renderEventHtml = async (_c: any, _s: any, _o: any) => '';
        const a = ctx.fns.agent.start({ model: "m1" });
        ctx.fns.session.save({ agent: a });
        await ctx.fns.session.appendUserMessage({ id: a.id, text: 'hi' });
        const b = ctx.fns.agent.start({ model: "m2", systemPrompt: "sp" });
        ctx.fns.session.save({ agent: b });

        // fresh ctx, same db — simulate restart
        const ctx2: any = await mkTestCtx();
        (ctx2.state as any).procs.db.connection = ctx.fns.procs.db.conn();
        const res = ctx2.fns.session.loadAll();
        expect(res.loaded).toBe(2);
        expect((ctx2.state as any).agent[a.id].messages).toEqual([{ role: "user", content: "hi" }]);
        expect((ctx2.state as any).agent[b.id].systemPrompt).toBe("sp");
    });
});
