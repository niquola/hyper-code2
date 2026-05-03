import { describe, test, expect } from "bun:test";
import connect from "../db/connect";
import migrate from "../db/migrate";
import save from "./save";
import appendMessage from "./appendMessage";
import appendEvent from "./appendEvent";
import appendUserMessage from "./appendUserMessage";
import appendAssistantMessage from "./appendAssistantMessage";
import appendErrorEvent from "./appendErrorEvent";
import appendThinkingEvent from "./appendThinkingEvent";
import appendAssistantEvent from "./appendAssistantEvent";
import appendToolCallEvent from "./appendToolCallEvent";
import getMessages from "./getMessages";
import getEvents from "./getEvents";

function mkCtx() {
  const ctx: any = { env: {}, state: {}, fns: { db: {}, session: {}, agent: {} } };
  ctx.fns.db.connect = connect;
  ctx.fns.db.migrate = migrate;
  ctx.fns.db.exec = (c: any, opts: { sql: string; params?: any }) => { const params = opts.params ?? []; const q = c.state.db.query(opts.sql); const res = Array.isArray(params) ? q.run(...params) : q.run(params); return { changes: c.state.db.changes, lastInsertRowid: Number(res.lastInsertRowid ?? 0) }; };
  ctx.fns.db.select = (c: any, opts: { sql: string; params?: any }) => { const params = opts.params ?? []; const q = c.state.db.query(opts.sql); return Array.isArray(params) ? q.all(...params) : q.all(params); };
  ctx.fns.agent.renderEventHtml = async () => '';
  Object.assign(ctx.fns.session, { save, appendMessage, appendEvent, appendUserMessage, appendAssistantMessage, appendErrorEvent, appendThinkingEvent, appendAssistantEvent, appendToolCallEvent, getMessages, getEvents });
  return ctx;
}

function seedAgent() {
  return { id: 'a1', model: 'm', systemPrompt: '', scratchpad: {}, messages: [], events: [], cursors: {}, subscribers: new Set<(ev: any, signal?: AbortSignal) => void>(), waiters: [], isStreaming: false, abortController: null, parentId: null, forkOffset: null };
}

describe('session append helpers', () => {
  test('append role-specific messages/events', async () => {
    const ctx: any = mkCtx();
    ctx.fns.db.connect(ctx, { path: ':memory:' });
    await ctx.fns.db.migrate(ctx);
    save(ctx, { agent: seedAgent() as any });
    await appendUserMessage(ctx, { id: 'a1', text: 'u' });
    appendAssistantMessage(ctx, { id: 'a1', msg: { content: 'a' } });

    await appendThinkingEvent(ctx, { id: 'a1', text: '...' });
    await appendToolCallEvent(ctx, { id: 'a1', payload: { name: 'evalCode', args: {}, result: '1', argsHtml: '', resultHtml: '', isError: false } });
    await appendAssistantEvent(ctx, { id: 'a1', payload: { text: 'done', html: '<p>done</p>' } });
    await appendErrorEvent(ctx, { id: 'a1', error: 'boom' });
    expect(getMessages(ctx, { id: 'a1' }).map((m: any) => m.role)).toEqual(['user', 'assistant']);
    expect(getEvents(ctx, { id: 'a1' }).map((e: any) => e.type)).toEqual(['user', 'thinking', 'tool_call', 'assistant', 'error']);
  });
});
