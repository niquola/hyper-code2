import { describe, test, expect } from "bun:test";
import connect from "../db/connect";
import migrate from "../db/migrate";
import save from "./save";
import appendMessage from "./appendMessage";
import appendEvent from "./appendEvent";
import getMessages from "./getMessages";
import getEvents from "./getEvents";

function mkCtx() {
  const ctx: any = { env: {}, state: {}, fns: { db: {}, session: {} } };
  ctx.fns.db.connect = connect;
  ctx.fns.db.migrate = migrate;
  ctx.fns.db.exec = (c: any, opts: { sql: string; params?: any }) => { const params = opts.params ?? []; const q = c.state.db.query(opts.sql); const res = Array.isArray(params) ? q.run(...params) : q.run(params); return { changes: c.state.db.changes, lastInsertRowid: Number(res.lastInsertRowid ?? 0) }; };
  ctx.fns.db.select = (c: any, opts: { sql: string; params?: any }) => { const params = opts.params ?? []; const q = c.state.db.query(opts.sql); return Array.isArray(params) ? q.all(...params) : q.all(params); };
  ctx.fns.session.save = save;
  ctx.fns.session.appendMessage = appendMessage;
  ctx.fns.session.appendEvent = appendEvent;
  ctx.fns.session.getMessages = getMessages;
  ctx.fns.session.getEvents = getEvents;
  return ctx;
}

function seedAgent() {
  return { id: "a1", model: "m", systemPrompt: "", scratchpad: {}, messages: [], events: [], cursors: {}, subscribers: new Set<(ev: any, signal?: AbortSignal) => void>(), waiters: [], isStreaming: false, abortController: null, parentId: null, forkOffset: null };
}

describe("session.appendMessage / appendEvent", () => {
  test("appends messages with incrementing idx", async () => {
    const ctx: any = mkCtx();
    ctx.fns.db.connect(ctx, { path: ':memory:' });
    await ctx.fns.db.migrate(ctx);
    save(ctx, { agent: seedAgent() as any });
    expect(appendMessage(ctx, { id: 'a1', message: { role: 'user', content: 'hi' } }).idx).toBe(0);
    expect(appendMessage(ctx, { id: 'a1', message: { role: 'assistant', content: 'yo' } }).idx).toBe(1);
    expect(getMessages(ctx, { id: 'a1' }).map((m: any) => m.content)).toEqual(['hi', 'yo']);
  });

  test("excluded_from_cursor flag round-trips and defaults to 0", async () => {
    const ctx: any = mkCtx();
    ctx.fns.db.connect(ctx, { path: ':memory:' });
    await ctx.fns.db.migrate(ctx);
    save(ctx, { agent: seedAgent() as any });
    appendMessage(ctx, { id: 'a1', message: { role: 'user', content: 'real input' } });
    appendMessage(ctx, { id: 'a1', message: { role: 'user', content: '§result:eval\n4', excluded_from_cursor: true } });
    const rows = ctx.fns.db.select(ctx, { sql: 'SELECT idx, content, excluded_from_cursor FROM messages WHERE agent_id = ? ORDER BY idx', params: ['a1'] });
    expect(rows).toEqual([
      { idx: 0, content: 'real input',          excluded_from_cursor: 0 },
      { idx: 1, content: '§result:eval\n4',   excluded_from_cursor: 1 },
    ]);
  });

  test("frontier query (workerLoop) skips excluded_from_cursor messages", async () => {
    const ctx: any = mkCtx();
    ctx.fns.db.connect(ctx, { path: ':memory:' });
    await ctx.fns.db.migrate(ctx);
    save(ctx, { agent: seedAgent() as any });
    appendMessage(ctx, { id: 'a1', message: { role: 'user',      content: 'real' } });                                      // idx 0 — real
    appendMessage(ctx, { id: 'a1', message: { role: 'assistant', content: '§eval\nx' } });                                // idx 1
    appendMessage(ctx, { id: 'a1', message: { role: 'user',      content: '§result:eval\n1', excluded_from_cursor: true } }); // idx 2 — synthetic
    appendMessage(ctx, { id: 'a1', message: { role: 'assistant', content: 'done' } });                                      // idx 3
    // Frontier should be 0 (real input), NOT 2 (synthetic §result).
    const r = ctx.fns.db.select(ctx, {
      sql: "SELECT COALESCE(MAX(idx), -1) AS max_idx FROM messages WHERE agent_id = ? AND role = 'user' AND excluded_from_cursor = 0",
      params: ['a1'],
    });
    expect(r[0].max_idx).toBe(0);
  });

  test("appends events with incrementing idx", async () => {
    const ctx: any = mkCtx();
    ctx.fns.db.connect(ctx, { path: ':memory:' });
    await ctx.fns.db.migrate(ctx);
    save(ctx, { agent: seedAgent() as any });
    expect(appendEvent(ctx, { id: 'a1', event: { type: 'user', text: 'hi' } }).idx).toBe(0);
    expect(appendEvent(ctx, { id: 'a1', event: { type: 'assistant', text: 'yo' } }).idx).toBe(1);
    expect(getEvents(ctx, { id: 'a1' }).map((e: any) => e.text)).toEqual(['hi', 'yo']);
  });
});
