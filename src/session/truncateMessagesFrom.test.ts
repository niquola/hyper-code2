import { describe, test, expect } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

// Seed a realistic transcript: user → assistant prose → §eval (marker) →
// §result (excluded_from_cursor) → assistant prose. Events mirror it, with
// messageIdx anchoring user/assistant/tool_call bubbles to their messages.
async function seed() {
    const ctx = await mkTestCtx();
    const agent = await ctx.fns.agent.start({ model: "mock:x" });
    const id = agent.id;
    await ctx.fns.session.appendMessage({ id, message: { role: "user", content: "hello" } });               // 0
    await ctx.fns.session.appendMessage({ id, message: { role: "assistant", content: "hi prose" } });        // 1
    await ctx.fns.session.appendMessage({ id, message: { role: "assistant", content: "§eval\nx=1" } });      // 2
    await ctx.fns.session.appendMessage({ id, message: { role: "user", content: "§result:eval\nout", excluded_from_cursor: true } }); // 3
    await ctx.fns.session.appendMessage({ id, message: { role: "assistant", content: "done" } });            // 4

    await ctx.fns.session.appendEvent({ id, event: { type: "user", text: "hello", messageIdx: 0 } });        // ev0
    await ctx.fns.session.appendEvent({ id, event: { type: "assistant", text: "hi prose", messageIdx: 1 } });// ev1
    await ctx.fns.session.appendEvent({ id, event: { type: "tool_call", name: "eval", messageIdx: 2 } });    // ev2
    await ctx.fns.session.appendEvent({ id, event: { type: "assistant", text: "done", messageIdx: 4 } });    // ev3
    return { ctx, id };
}

const rawMsgs = (ctx: any, id: string) => ctx.fns.procs.db.select({
    sql: "SELECT idx, role, content, excluded_from_cursor exc FROM messages WHERE agent_id=? ORDER BY idx", params: [id],
});
const rawEvents = (ctx: any, id: string) => ctx.fns.procs.db.select({
    sql: "SELECT idx FROM events WHERE agent_id=? ORDER BY idx", params: [id],
});

describe("session.truncateMessagesFrom", () => {
    test("deletes message at idx + its event, keeps earlier rows AND their flags", async () => {
        const { ctx, id } = await seed();
        const res = await ctx.fns.session.truncateMessagesFrom({ id, from: 4 });
        expect(res).toEqual({ ok: true, from: 4 });

        const msgs = await rawMsgs(ctx, id);
        expect(msgs.map((m: any) => m.idx)).toEqual([0, 1, 2, 3]); // idx 4 gone, no renumber
        // The §result flag survived (the old getMessages→replaceMessages round-trip lost it).
        expect(Number(msgs.find((m: any) => m.idx === 3).exc)).toBe(1);
        // Event ev3 (messageIdx 4) gone; ev0..ev2 kept.
        expect((await rawEvents(ctx, id)).map((e: any) => e.idx)).toEqual([0, 1, 2]);
    });

    test("walks back a marker pair: truncating from §result drops the §eval too", async () => {
        const { ctx, id } = await seed();
        const res = await ctx.fns.session.truncateMessagesFrom({ id, from: 3 }); // §result → walk back to §eval (2)
        expect(res).toEqual({ ok: true, from: 2 });
        expect((await rawMsgs(ctx, id)).map((m: any) => m.idx)).toEqual([0, 1]);
        // boundary event = ev2 (tool_call, messageIdx 2) → ev2 & ev3 removed.
        expect((await rawEvents(ctx, id)).map((e: any) => e.idx)).toEqual([0, 1]);
    });

    test("does NOT drop excluded_from_llm rows that survive the cut", async () => {
        const ctx = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:x" });
        const id = agent.id;
        await ctx.fns.session.appendMessage({ id, message: { role: "user", content: "keep me", excluded_from_llm: true } }); // 0
        await ctx.fns.session.appendMessage({ id, message: { role: "user", content: "cut me" } });                            // 1
        await ctx.fns.session.truncateMessagesFrom({ id, from: 1 });
        const msgs = await rawMsgs(ctx, id);
        expect(msgs.map((m: any) => m.content)).toEqual(["keep me"]); // the old round-trip would have nuked it
    });

    test("invalid idx (beyond end) is rejected", async () => {
        const { ctx, id } = await seed();
        expect(await ctx.fns.session.truncateMessagesFrom({ id, from: 99 })).toEqual({ ok: false, reason: "invalid idx" });
    });
});
