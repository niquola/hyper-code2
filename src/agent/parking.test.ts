import { describe, expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";
import wakeWorker from "./wakeWorker";

async function drainUntilIdle(ctx: any, deadlineMs = 5000) {
    const loop = ctx.fns.agent.workerLoop({});
    const t0 = Date.now();
    while (Date.now() - t0 < deadlineMs) {
        const busy = (await ctx.fns.procs.db.select({
            sql: `SELECT COUNT(*) AS n FROM agents
                   WHERE archived_at IS NULL AND (run_state = 'running' OR next_run_at IS NOT NULL)`,
        }))[0]?.n ?? 0;
        if (Number(busy) === 0) break;
        await new Promise((r) => setTimeout(r, 20));
    }
    ctx.state.workerLoopRunning = false;
    wakeWorker(ctx, null);
    await loop;
}

const RESETS_AT = Date.now() + 3 * 24 * 3_600_000;

function limitInfo(over: Partial<types.llm.FailureInfo> = {}): types.llm.FailureInfo {
    return {
        kind: "usage_limit",
        provider: "mock",
        account: "default",
        message: "Лимит подписки mock исчерпан.",
        retryable: false,
        resetsAt: RESETS_AT,
        planType: "prolite",
        ...over,
    } as types.llm.FailureInfo;
}

describe("usage-limit parking", () => {
    test("parks every agent sharing the credential, not the one that failed", async () => {
        const ctx: any = await mkTestCtx();
        const a = await ctx.fns.agent.start({ model: "mock:test" });
        const b = await ctx.fns.agent.start({ model: "mock:test" });
        const other = await ctx.fns.agent.start({ model: "mock/second:test" });

        const result = await ctx.fns.agent.parkOnUsageLimit({ info: limitInfo(), originAgentId: a.id });

        expect(result.parked.sort()).toEqual([a.id, b.id].sort());
        expect(result.parked).not.toContain(other.id);

        const rows = await ctx.fns.procs.db.select({
            sql: "SELECT id, wake_at, wake_reason, next_run_at, last_error FROM agents WHERE id IN (?, ?) ORDER BY id",
            params: [a.id, b.id],
        });
        for (const row of rows) {
            // A wait, not a failure: no error badge, no pending run, a wake set
            // after the reset moment.
            expect(Number(row.wake_at)).toBeGreaterThan(RESETS_AT);
            expect(row.last_error).toBeNull();
            expect(row.next_run_at).toBeNull();
            expect(String(row.wake_reason)).toContain("usage limit");
        }
        // Jitter must spread the group, otherwise they all hit the API together.
        expect(Number(rows[0].wake_at)).not.toBe(Number(rows[1].wake_at));

        const parked = (await ctx.fns.session.load({ id: a.id })).scratchpad.parked;
        expect(parked).toMatchObject({ reason: "usage_limit", provider: "mock", account: "default", planType: "prolite", resetsAt: RESETS_AT });
        expect((await ctx.fns.session.getEvents({ id: a.id })).at(-1)).toMatchObject({ type: "parked", provider: "mock" });
    });

    test("an unknown reset time parks for the fallback window instead of failing", async () => {
        const ctx: any = await mkTestCtx();
        const a = await ctx.fns.agent.start({ model: "mock:test" });
        const now = Date.now();
        const result = await ctx.fns.agent.parkOnUsageLimit({ info: limitInfo({ resetsAt: null }), fallbackMs: 600_000, now });
        expect(result.parked).toEqual([a.id]);
        expect(result.resetsAt).toBe(now + 600_000);
    });

    test("a reset moment already in the past does not refuse to park", async () => {
        const ctx: any = await mkTestCtx();
        await ctx.fns.agent.start({ model: "mock:test" });
        const now = Date.now();
        const result = await ctx.fns.agent.parkOnUsageLimit({ info: limitInfo({ resetsAt: now - 5_000 }), fallbackMs: 60_000, now });
        expect(result.resetsAt).toBe(now + 60_000);
    });

    test("parking preserves a user's own wake and unpark restores it", async () => {
        const ctx: any = await mkTestCtx();
        const a = await ctx.fns.agent.start({ model: "mock:test" });
        const mine = Date.now() + 30 * 60_000;
        await ctx.fns.agent.wakeAt({ id: a.id, at: mine, reason: "my own reminder" });

        await ctx.fns.agent.parkOnUsageLimit({ info: limitInfo() });
        expect((await ctx.fns.session.load({ id: a.id })).scratchpad.parked.previousWake).toMatchObject({ at: mine, reason: "my own reminder" });

        const un = await ctx.fns.agent.unpark({ id: a.id, reason: "model-switch" });
        expect(un.wasParked).toBe(true);
        const row = (await ctx.fns.procs.db.select({ sql: "SELECT wake_at, wake_reason FROM agents WHERE id = ?", params: [a.id] }))[0];
        expect(Number(row.wake_at)).toBe(mine);
        expect(row.wake_reason).toBe("my own reminder");
        expect((await ctx.fns.session.load({ id: a.id })).scratchpad.parked).toBeUndefined();
    });

    test("unpark resumes an agent whose messages went unanswered", async () => {
        const ctx: any = await mkTestCtx();
        const a = await ctx.fns.agent.start({ model: "mock:test" });
        await ctx.fns.session.appendMessage({ id: a.id, message: { role: "user", content: "do the thing" } });
        await ctx.fns.agent.parkOnUsageLimit({ info: limitInfo() });
        expect((await ctx.fns.procs.db.select({ sql: "SELECT next_run_at FROM agents WHERE id = ?", params: [a.id] }))[0].next_run_at).toBeNull();

        const un = await ctx.fns.agent.unpark({ id: a.id, reason: "manual" });
        expect(un.resumed).toBe(true);
        expect((await ctx.fns.procs.db.select({ sql: "SELECT next_run_at FROM agents WHERE id = ?", params: [a.id] }))[0].next_run_at).not.toBeNull();
    });

    test("the scheduled wake clears the parking and continues the work", async () => {
        const ctx: any = await mkTestCtx();
        const a = await ctx.fns.agent.start({ model: "mock:test" });
        await ctx.fns.session.appendMessage({ id: a.id, message: { role: "user", content: "do the thing" } });
        const now = Date.now();
        const parked = await ctx.fns.agent.parkOnUsageLimit({ info: limitInfo({ resetsAt: null }), fallbackMs: 60_000, now });
        expect(parked.parked).toEqual([a.id]);

        const wakeAt = Number((await ctx.fns.session.load({ id: a.id })).scratchpad.parked.wakeAt);
        expect((await ctx.fns.agent.deliverWakes({ now: wakeAt + 1 })).delivered).toEqual([a.id]);

        const reloaded = await ctx.fns.session.load({ id: a.id });
        expect(reloaded.scratchpad.parked).toBeUndefined();
        const row = (await ctx.fns.procs.db.select({ sql: "SELECT wake_at, next_run_at FROM agents WHERE id = ?", params: [a.id] }))[0];
        expect(row.wake_at).toBeNull();
        expect(row.next_run_at).not.toBeNull();
    });

    test("unparking an agent that was never parked is a no-op", async () => {
        const ctx: any = await mkTestCtx();
        const a = await ctx.fns.agent.start({ model: "mock:test" });
        expect(await ctx.fns.agent.unpark({ id: a.id })).toMatchObject({ wasParked: false, resumed: false });
    });

    test("only a usage_limit classification may park", async () => {
        const ctx: any = await mkTestCtx();
        await ctx.fns.agent.start({ model: "mock:test" });
        await expect(ctx.fns.agent.parkOnUsageLimit({ info: limitInfo({ kind: "rate_limit" }) })).rejects.toThrow(/usage_limit/);
    });

    test("the worker parks instead of retrying, and leaves no error badge", async () => {
        const ctx: any = await mkTestCtx();
        let calls = 0;
        ctx.fns.agent.run = async () => {
            calls++;
            const error: any = new Error("Лимит подписки mock исчерпан.");
            error.failure = limitInfo();
            throw error;
        };

        const a = await ctx.fns.agent.start({ model: "mock:test" });
        await ctx.fns.session.save({ agent: a });
        await ctx.fns.session.appendUserMessage({ id: a.id, text: "go" });
        await ctx.fns.procs.db.run({ sql: "UPDATE agents SET next_run_at = ? WHERE id = ?", params: [Date.now(), a.id] });

        await drainUntilIdle(ctx);

        // Exactly one attempt: the transient path would have scheduled a second.
        expect(calls).toBe(1);
        const row = (await ctx.fns.procs.db.select({
            sql: "SELECT run_state, last_error, next_run_at, wake_at, last_processed_msg_idx FROM agents WHERE id = ?",
            params: [a.id],
        }))[0];
        expect(row.run_state).toBe("idle");
        expect(row.last_error).toBeNull();
        expect(row.next_run_at).toBeNull();
        expect(Number(row.wake_at)).toBeGreaterThan(Date.now());
        // The message stayed unread, so the wake-up will answer it.
        expect(Number(row.last_processed_msg_idx)).toBe(-1);

        const events = await ctx.fns.session.getEvents({ id: a.id });
        expect(events.some((e: any) => e.type === "parked")).toBe(true);
        expect(events.some((e: any) => e.type === "error")).toBe(false);
    });
});
