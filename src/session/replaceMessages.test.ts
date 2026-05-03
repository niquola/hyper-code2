import { describe, test, expect } from "bun:test";
import connect from "../db/connect";
import migrate from "../db/migrate";
import save from "./save";
import replaceMessages from "./replaceMessages";
import replaceEvents from "./replaceEvents";
import getMessages from "./getMessages";
import getEvents from "./getEvents";

function mkCtx() {
  const ctx: any = { env: {}, state: {}, fns: { db: {}, session: {} } };
  ctx.fns.db.connect = connect;
  ctx.fns.db.migrate = migrate;
  ctx.fns.db.exec = (c: any, opts: { sql: string; params?: any }) => { const params = opts.params ?? []; const q = c.state.db.query(opts.sql); const res = Array.isArray(params) ? q.run(...params) : q.run(params); return { changes: c.state.db.changes, lastInsertRowid: Number(res.lastInsertRowid ?? 0) }; };
  ctx.fns.db.select = (c: any, opts: { sql: string; params?: any }) => { const params = opts.params ?? []; const q = c.state.db.query(opts.sql); return Array.isArray(params) ? q.all(...params) : q.all(params); };
  ctx.fns.session.save = save;
  ctx.fns.session.replaceMessages = replaceMessages;
  ctx.fns.session.replaceEvents = replaceEvents;
  ctx.fns.session.getMessages = getMessages;
  ctx.fns.session.getEvents = getEvents;
  return ctx;
}

function seedAgent() {
  return { id: 'a1', model: 'm', systemPrompt: '', scratchpad: {}, messages: [], events: [], cursors: {}, subscribers: new Set<(ev: any, signal?: AbortSignal) => void>(), waiters: [], isStreaming: false, abortController: null, parentId: null, forkOffset: null };
}

describe('session.replaceMessages / replaceEvents', () => {
  test('replaces full message list', async () => {
    const ctx: any = mkCtx();
    ctx.fns.db.connect(ctx, { path: ':memory:' });
    await ctx.fns.db.migrate(ctx);
    save(ctx, { agent: seedAgent() as any });
    replaceMessages(ctx, { id: 'a1', messages: [{ role: 'user', content: 'x' }, { role: 'assistant', content: 'y' }] });
    replaceMessages(ctx, { id: 'a1', messages: [{ role: 'user', content: 'z' }] });
    expect(getMessages(ctx, { id: 'a1' }).map((m: any) => m.content)).toEqual(['z']);
  });

  test('replaces full event list', async () => {
    const ctx: any = mkCtx();
    ctx.fns.db.connect(ctx, { path: ':memory:' });
    await ctx.fns.db.migrate(ctx);
    save(ctx, { agent: seedAgent() as any });
    replaceEvents(ctx, { id: 'a1', events: [{ type: 'user', text: 'x' }, { type: 'assistant', text: 'y' }] });
    replaceEvents(ctx, { id: 'a1', events: [{ type: 'assistant', text: 'z' }] });
    expect(getEvents(ctx, { id: 'a1' }).map((e: any) => e.text)).toEqual(['z']);
  });
});
