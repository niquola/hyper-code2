import { describe, test, expect } from "bun:test";
import connect from "../db/connect";
import migrate from "../db/migrate";
import save from "./save";
import appendMessage from "./appendMessage";
import appendEvent from "./appendEvent";
import getMessages from "./getMessages";
import getFullMessages from "./getFullMessages";
import getEvents from "./getEvents";
import syncAgentState from "./syncAgentState";

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
  ctx.fns.session.getFullMessages = getFullMessages;
  ctx.fns.session.getEvents = getEvents;
  ctx.fns.session.syncAgentState = syncAgentState;
  return ctx;
}

function baseAgent(id: string, extra: any = {}) {
  return { id, model: 'm', systemPrompt: '', scratchpad: {}, messages: [], events: [], cursors: {}, subscribers: new Set<(ev: any, signal?: AbortSignal) => void>(), waiters: [], isStreaming: false, abortController: null, parentId: extra.parentId ?? null, forkOffset: extra.forkOffset ?? null };
}

describe('session.syncAgentState', () => {
  test('syncs root agent from db messages/events', async () => {
    const ctx: any = mkCtx();
    ctx.fns.db.connect(ctx, ':memory:');
    await ctx.fns.db.migrate(ctx);
    const a = baseAgent('a1');
    save(ctx, a);
    appendMessage(ctx, 'a1', { role: 'user', content: 'hi' });
    appendEvent(ctx, 'a1', { type: 'user', text: 'hi' });
    a.messages = []; a.events = [];
    syncAgentState(ctx, a);
    expect(a.messages.map((m: any) => m.content)).toEqual(['hi']);
    expect(a.events.map((e: any) => e.text)).toEqual(['hi']);
  });

  test('syncs fork agent from full inherited transcript', async () => {
    const ctx: any = mkCtx();
    ctx.fns.db.connect(ctx, ':memory:');
    await ctx.fns.db.migrate(ctx);
    save(ctx, baseAgent('parent'));
    appendMessage(ctx, 'parent', { role: 'user', content: 'parent hi' });
    save(ctx, baseAgent('child', { parentId: 'parent', forkOffset: 1 }));
    appendMessage(ctx, 'child', { role: 'user', content: 'child hi' });
    const child = baseAgent('child', { parentId: 'parent', forkOffset: 1 });
    syncAgentState(ctx, child);
    expect(child.messages.map((m: any) => m.content)).toEqual(['parent hi', 'child hi']);
  });
});
