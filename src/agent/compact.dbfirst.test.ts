import { describe, test, expect } from "bun:test";
import compact from './compact';
import connect from '../db/connect';
import migrate from '../db/migrate';
import save from '../session/save';
import replaceMessages from '../session/replaceMessages';
import getMessages from '../session/getMessages';
import syncAgentState from '../session/syncAgentState';
import getFullMessages from '../session/getFullMessages';
import getEvents from '../session/getEvents';

function mkCtx() {
  const ctx: any = { env: {}, state: {}, fns: { db: {}, session: {} } };
  ctx.fns.db.connect = connect;
  ctx.fns.db.migrate = migrate;
  ctx.fns.db.exec = (c: any, sql: string, params: any) => { const q = c.state.db.query(sql); const res = Array.isArray(params) ? q.run(...params) : q.run(params); return { changes: c.state.db.changes, lastInsertRowid: Number(res.lastInsertRowid ?? 0) }; };
  ctx.fns.db.select = (c: any, sql: string, params: any = []) => { const q = c.state.db.query(sql); return Array.isArray(params) ? q.all(...params) : q.all(params); };
  ctx.fns.session.save = save;
  ctx.fns.session.replaceMessages = replaceMessages;
  ctx.fns.session.getMessages = getMessages;
  ctx.fns.session.getFullMessages = getFullMessages;
  ctx.fns.session.getEvents = getEvents;
  ctx.fns.session.syncAgentState = syncAgentState;
  return ctx;
}

describe('agent.compact db-first', () => {
  test('replaces last tool message in db-backed state', async () => {
    const ctx: any = mkCtx();
    ctx.fns.db.connect(ctx, ':memory:');
    await ctx.fns.db.migrate(ctx);
    const agent: any = { id: 'a1', model: 'm', systemPrompt: '', tools: [], scratchpad: {}, messages: [], events: [], cursors: {}, subscribers: new Set(), waiters: [], isStreaming: false, abortController: null, parentId: null, forkOffset: null };
    save(ctx, agent);
    replaceMessages(ctx, 'a1', [
      { role: 'user', content: 'u' },
      { role: 'assistant', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'evalCode', arguments: '{}' } }] },
      { role: 'tool', tool_call_id: 'c1', content: 'very long' },
    ]);
    syncAgentState(ctx, agent);
    const res = compact(ctx, agent, 'short');
    expect(res.replaced).toBe(true);
    expect(getMessages(ctx, 'a1').at(-1)?.content).toBe('[compacted] short');
  });
});
