import { afterAll, describe, expect, test } from "bun:test";
import { mkTestCtx } from "../../src/_testCtx.entry";
import prepareToday from "./prepareToday";

const contexts: any[] = [];
afterAll(async () => { for (const ctx of contexts) await ctx.fns.procs.db.close?.({}); });

describe("calendar.prepareToday", () => {
    test("dry run reports eligible meetings without creating agents", async () => {
        const ctx: any = await mkTestCtx(); contexts.push(ctx);
        ctx.fns.gcal = { events: async () => [{ id: "event-dry", summary: "Planning", start: "2030-01-02T10:00:00Z", end: "2030-01-02T11:00:00Z", attendees: [] }] };
        const result = await prepareToday(ctx, null, { account: "niquola@health-samurai.io", dryRun: true, now: Date.parse("2030-01-02T09:00:00Z") });
        expect(result.created).toHaveLength(0);
        expect(result.skipped[0].reason).toBe("dry run");
    });

    test("existing event-tagged chat prevents a duplicate", async () => {
        const ctx: any = await mkTestCtx(); contexts.push(ctx);
        const eventId = `event-${crypto.randomUUID()}`;
        const id = `cal-${crypto.randomUUID()}`;
        const now = Date.now();
        await ctx.fns.procs.db.run({ sql: `INSERT INTO agents (id, model, system_prompt, scratchpad, created_at, updated_at, run_state) VALUES (?, ?, '', ?, ?, ?, 'idle')`, params: [id, "mock:test", JSON.stringify({ calendarEventKey: `niquola@health-samurai.io:${eventId}` }), now, now] });
        ctx.fns.gcal = { events: async () => [{ id: eventId, summary: "Duplicate", start: "2030-01-02T10:00:00Z", end: "2030-01-02T11:00:00Z" }] };
        const result = await prepareToday(ctx, null, { account: "niquola@health-samurai.io", now: Date.parse("2030-01-02T09:00:00Z") });
        expect(result.created).toHaveLength(0);
        expect(result.skipped[0].reason).toContain("chat exists");
        await ctx.fns.procs.db.run({ sql: "DELETE FROM agents WHERE id = ?", params: [id] });
    });
});
