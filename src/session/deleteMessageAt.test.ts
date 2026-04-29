import { describe, test, expect } from "bun:test";
import connect from "../db/connect";
import migrate from "../db/migrate";
import save from "./save";
import replaceMessages from "./replaceMessages";
import getMessages from "./getMessages";
import deleteMessageAt from "./deleteMessageAt";
import truncateMessagesFrom from "./truncateMessagesFrom";

function mkCtx() {
  const ctx: any = { env: {}, state: {}, fns: { db: {}, session: {} } };
  ctx.fns.db.connect = connect;
  ctx.fns.db.migrate = migrate;
  ctx.fns.db.exec = (c: any, sql: string, params: any) => { const q = c.state.db.query(sql); const res = Array.isArray(params) ? q.run(...params) : q.run(params); return { changes: c.state.db.changes, lastInsertRowid: Number(res.lastInsertRowid ?? 0) }; };
  ctx.fns.db.select = (c: any, sql: string, params: any = []) => { const q = c.state.db.query(sql); return Array.isArray(params) ? q.all(...params) : q.all(params); };
  Object.assign(ctx.fns.session, { save, replaceMessages, getMessages, deleteMessageAt, truncateMessagesFrom });
  return ctx;
}

function seedAgent() {
  return { id: 'a1', model: 'm', systemPrompt: '', tools: [], scratchpad: {}, messages: [], events: [], cursors: {}, subscribers: new Set(), waiters: [], isStreaming: false, abortController: null, parentId: null, forkOffset: null };
}

describe('delete message operations', () => {
  test('deletes a plain message by idx', async () => {
    const ctx: any = mkCtx(); ctx.fns.db.connect(ctx, ':memory:'); await ctx.fns.db.migrate(ctx); save(ctx, seedAgent());
    replaceMessages(ctx, 'a1', [{ role: 'user', content: 'u1' }, { role: 'assistant', content: 'a1' }, { role: 'user', content: 'u2' }]);
    expect(deleteMessageAt(ctx, 'a1', 1).ok).toBe(true);
    expect(getMessages(ctx, 'a1').map((m: any) => m.content)).toEqual(['u1', 'u2']);
  });

  test('rejects deleting tool message alone', async () => {
    const ctx: any = mkCtx(); ctx.fns.db.connect(ctx, ':memory:'); await ctx.fns.db.migrate(ctx); save(ctx, seedAgent());
    replaceMessages(ctx, 'a1', [{ role: 'assistant', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'evalCode', arguments: '{}' } }] }, { role: 'tool', tool_call_id: 'c1', content: 'x' }]);
    expect(deleteMessageAt(ctx, 'a1', 1).ok).toBe(false);
  });

  test('truncate from walks back over assistant tool-call message', async () => {
    const ctx: any = mkCtx(); ctx.fns.db.connect(ctx, ':memory:'); await ctx.fns.db.migrate(ctx); save(ctx, seedAgent());
    replaceMessages(ctx, 'a1', [{ role: 'user', content: 'u' }, { role: 'assistant', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'evalCode', arguments: '{}' } }] }, { role: 'tool', tool_call_id: 'c1', content: 'x' }, { role: 'assistant', content: 'done' }]);
    const res = truncateMessagesFrom(ctx, 'a1', 2);
    expect(res.ok).toBe(true);
    expect(res.from).toBe(1);
    expect(getMessages(ctx, 'a1').map((m: any) => m.content ?? m.role)).toEqual(['u']);
  });
});
