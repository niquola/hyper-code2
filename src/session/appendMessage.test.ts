import { describe, test, expect } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

function seedAgent() {
  return { id: "a1", model: "m", systemPrompt: "", scratchpad: {}, messages: [], events: [], cursors: {}, subscribers: new Set<(ev: any, signal?: AbortSignal) => void>(), waiters: [], isStreaming: false, abortController: null, parentId: null, forkOffset: null };
}

describe("session.appendMessage / appendEvent", () => {
  test("appends messages with incrementing idx", async () => {
    const ctx: any = await mkTestCtx();
    await ctx.fns.session.save({ agent: seedAgent() as any });
    expect((await ctx.fns.session.appendMessage({ id: 'a1', message: { role: 'user', content: 'hi' } })).idx).toBe(0);
    expect((await ctx.fns.session.appendMessage({ id: 'a1', message: { role: 'assistant', content: 'yo' } })).idx).toBe(1);
    expect((await ctx.fns.session.getMessages({ id: 'a1' })).map((m: any) => m.content)).toEqual(['hi', 'yo']);
  });

  test("excluded_from_cursor flag round-trips and defaults to 0", async () => {
    const ctx: any = await mkTestCtx();
    await ctx.fns.session.save({ agent: seedAgent() as any });
    await ctx.fns.session.appendMessage({ id: 'a1', message: { role: 'user', content: 'real input' } });
    await ctx.fns.session.appendMessage({ id: 'a1', message: { role: 'user', content: '§result:eval\n4', excluded_from_cursor: true } });
    const rows = await ctx.fns.procs.db.select({ sql: 'SELECT idx, content, excluded_from_cursor FROM messages WHERE agent_id = ? ORDER BY idx', params: ['a1'] });
    expect(rows).toEqual([
      { idx: 0, content: 'real input',          excluded_from_cursor: 0 },
      { idx: 1, content: '§result:eval\n4',   excluded_from_cursor: 1 },
    ]);
  });

  test("frontier query (workerLoop) skips excluded_from_cursor messages", async () => {
    const ctx: any = await mkTestCtx();
    await ctx.fns.session.save({ agent: seedAgent() as any });
    await ctx.fns.session.appendMessage({ id: 'a1', message: { role: 'user',      content: 'real' } });                                      // idx 0 — real
    await ctx.fns.session.appendMessage({ id: 'a1', message: { role: 'assistant', content: '§eval\nx' } });                                // idx 1
    await ctx.fns.session.appendMessage({ id: 'a1', message: { role: 'user',      content: '§result:eval\n1', excluded_from_cursor: true } }); // idx 2 — synthetic
    await ctx.fns.session.appendMessage({ id: 'a1', message: { role: 'assistant', content: 'done' } });                                      // idx 3
    // Frontier should be 0 (real input), NOT 2 (synthetic §result).
    const r = await ctx.fns.procs.db.select({
      sql: "SELECT COALESCE(MAX(idx), -1) AS max_idx FROM messages WHERE agent_id = ? AND role = 'user' AND excluded_from_cursor = 0",
      params: ['a1'],
    });
    expect(r[0].max_idx).toBe(0);
  });

  test("appends events with incrementing idx", async () => {
    const ctx: any = await mkTestCtx();
    await ctx.fns.session.save({ agent: seedAgent() as any });
    expect((await ctx.fns.session.appendEvent({ id: 'a1', event: { type: 'user', text: 'hi' } })).idx).toBe(0);
    expect((await ctx.fns.session.appendEvent({ id: 'a1', event: { type: 'assistant', text: 'yo' } })).idx).toBe(1);
    expect((await ctx.fns.session.getEvents({ id: 'a1' })).map((e: any) => e.text)).toEqual(['hi', 'yo']);
  });
});
