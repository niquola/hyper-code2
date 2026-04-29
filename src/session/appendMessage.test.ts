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
  ctx.fns.db.exec = (c: any, sql: string, params: any) => { const q = c.state.db.query(sql); const res = Array.isArray(params) ? q.run(...params) : q.run(params); return { changes: c.state.db.changes, lastInsertRowid: Number(res.lastInsertRowid ?? 0) }; };
  ctx.fns.db.select = (c: any, sql: string, params: any = []) => { const q = c.state.db.query(sql); return Array.isArray(params) ? q.all(...params) : q.all(params); };
  ctx.fns.session.save = save;
  ctx.fns.session.appendMessage = appendMessage;
  ctx.fns.session.appendEvent = appendEvent;
  ctx.fns.session.getMessages = getMessages;
  ctx.fns.session.getEvents = getEvents;
  return ctx;
}

function seedAgent() {
  return { id: "a1", model: "m", systemPrompt: "", tools: [], scratchpad: {}, messages: [], events: [], cursors: {}, subscribers: new Set(), waiters: [], isStreaming: false, abortController: null, parentId: null, forkOffset: null };
}

describe("session.appendMessage / appendEvent", () => {
  test("appends messages with incrementing idx", async () => {
    const ctx: any = mkCtx();
    ctx.fns.db.connect(ctx, ':memory:');
    await ctx.fns.db.migrate(ctx);
    save(ctx, seedAgent());
    expect(appendMessage(ctx, 'a1', { role: 'user', content: 'hi' }).idx).toBe(0);
    expect(appendMessage(ctx, 'a1', { role: 'assistant', content: 'yo' }).idx).toBe(1);
    expect(getMessages(ctx, 'a1').map((m: any) => m.content)).toEqual(['hi', 'yo']);
  });

  test("appends events with incrementing idx", async () => {
    const ctx: any = mkCtx();
    ctx.fns.db.connect(ctx, ':memory:');
    await ctx.fns.db.migrate(ctx);
    save(ctx, seedAgent());
    expect(appendEvent(ctx, 'a1', { type: 'user', text: 'hi' }).idx).toBe(0);
    expect(appendEvent(ctx, 'a1', { type: 'assistant', text: 'yo' }).idx).toBe(1);
    expect(getEvents(ctx, 'a1').map((e: any) => e.text)).toEqual(['hi', 'yo']);
  });
});
