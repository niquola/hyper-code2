import { describe, test, expect } from "bun:test";
import connect from "../db/connect";
import migrate from "../db/migrate";
import save from "./save";
import appendMessage from "./appendMessage";
import appendEvent from "./appendEvent";
import appendUserMessage from "./appendUserMessage";
import appendAssistantMessage from "./appendAssistantMessage";
import appendToolMessage from "./appendToolMessage";
import appendErrorEvent from "./appendErrorEvent";
import appendThinkingEvent from "./appendThinkingEvent";
import appendAssistantEvent from "./appendAssistantEvent";
import appendToolCallEvent from "./appendToolCallEvent";
import getMessages from "./getMessages";
import getEvents from "./getEvents";

function mkCtx() {
  const ctx: any = { env: {}, state: {}, fns: { db: {}, session: {} } };
  ctx.fns.db.connect = connect;
  ctx.fns.db.migrate = migrate;
  ctx.fns.db.exec = (c: any, sql: string, params: any) => { const q = c.state.db.query(sql); const res = Array.isArray(params) ? q.run(...params) : q.run(params); return { changes: c.state.db.changes, lastInsertRowid: Number(res.lastInsertRowid ?? 0) }; };
  ctx.fns.db.select = (c: any, sql: string, params: any = []) => { const q = c.state.db.query(sql); return Array.isArray(params) ? q.all(...params) : q.all(params); };
  Object.assign(ctx.fns.session, { save, appendMessage, appendEvent, appendUserMessage, appendAssistantMessage, appendToolMessage, appendErrorEvent, appendThinkingEvent, appendAssistantEvent, appendToolCallEvent, getMessages, getEvents });
  return ctx;
}

function seedAgent() {
  return { id: 'a1', model: 'm', systemPrompt: '', tools: [], scratchpad: {}, messages: [], events: [], cursors: {}, subscribers: new Set<(ev: any, signal?: AbortSignal) => void>(), waiters: [], isStreaming: false, abortController: null, parentId: null, forkOffset: null };
}

describe('session append helpers', () => {
  test('append role-specific messages/events', async () => {
    const ctx: any = mkCtx();
    ctx.fns.db.connect(ctx, ':memory:');
    await ctx.fns.db.migrate(ctx);
    save(ctx, seedAgent());
    appendUserMessage(ctx, 'a1', 'u');
    appendAssistantMessage(ctx, 'a1', { content: 'a' });
    appendToolMessage(ctx, 'a1', 'c1', 't');
    appendThinkingEvent(ctx, 'a1', '...');
    appendToolCallEvent(ctx, 'a1', { name: 'evalCode', args: {}, result: '1', argsHtml: '', resultHtml: '', isError: false });
    appendAssistantEvent(ctx, 'a1', { text: 'done', html: '<p>done</p>' });
    appendErrorEvent(ctx, 'a1', 'boom');
    expect(getMessages(ctx, 'a1').map((m: any) => m.role)).toEqual(['user', 'assistant', 'tool']);
    expect(getEvents(ctx, 'a1').map((e: any) => e.type)).toEqual(['thinking', 'tool_call', 'assistant', 'error']);
  });
});
