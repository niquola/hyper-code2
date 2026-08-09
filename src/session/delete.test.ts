import { test, expect, describe } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("session.delete", () => {
    test("removes agent row + messages + events", async () => {
        const ctx: any = await mkTestCtx();
        ctx.fns.agent.renderEventHtml = async (_c: any, _s: any, _o: any) => '';
        const agent = ctx.fns.agent.start({ model: "m" });
        ctx.fns.session.save({ agent });
        await ctx.fns.session.appendUserMessage({ id: agent.id, text: 'hi' });
        ctx.fns.session.appendEvent({ id: agent.id, event: { type: 'user', text: 'hi' } });

        const r = ctx.fns.session.delete({ id: agent.id });
        expect(r.ok).toBe(true);

        const db = ctx.fns.procs.db.conn();
        expect((db.query("SELECT COUNT(*) AS n FROM agents").get() as any).n).toBe(0);
        expect((db.query("SELECT COUNT(*) AS n FROM messages").get() as any).n).toBe(0);
        expect((db.query("SELECT COUNT(*) AS n FROM events").get() as any).n).toBe(0);
    });

    test("deleting unknown id is a no-op that returns ok:false", async () => {
        const ctx: any = await mkTestCtx();
        const r = ctx.fns.session.delete({ id: "nope" });
        expect(r.ok).toBe(false);
    });
});
