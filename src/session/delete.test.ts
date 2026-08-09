import { test, expect, describe } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("session.delete", () => {
    test("removes agent row + messages + events", async () => {
        const ctx: any = await mkTestCtx();
        ctx.fns.agent.renderEventHtml = async (_c: any, _s: any, _o: any) => '';
        const agent = await ctx.fns.agent.start({ model: "m" });
        await ctx.fns.session.save({ agent });
        await ctx.fns.session.appendUserMessage({ id: agent.id, text: 'hi' });
        await ctx.fns.session.appendEvent({ id: agent.id, event: { type: 'user', text: 'hi' } });

        const r = await ctx.fns.session.delete({ id: agent.id });
        expect(r.ok).toBe(true);

        // COUNT(*) is a BIGINT → comes back as a string from pg.
        const count = async (table: string) =>
            Number(((await ctx.fns.procs.db.select({ sql: `SELECT COUNT(*) AS n FROM ${table}` })) as any[])[0].n);
        expect(await count("agents")).toBe(0);
        expect(await count("messages")).toBe(0);
        expect(await count("events")).toBe(0);
    });

    test("deleting unknown id is a no-op that returns ok:false", async () => {
        const ctx: any = await mkTestCtx();
        const r = await ctx.fns.session.delete({ id: "nope" });
        expect(r.ok).toBe(false);
    });
});
