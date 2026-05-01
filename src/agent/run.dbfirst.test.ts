import { describe, test, expect } from "bun:test";
import run from './run';
import connect from '../db/connect';
import migrate from '../db/migrate';
import save from '../session/save';
import load from '../session/load';
import appendMessage from '../session/appendMessage';
import appendEvent from '../session/appendEvent';
import getMessages from '../session/getMessages';
import getFullMessages from '../session/getFullMessages';
import getEvents from '../session/getEvents';
import start from './start';
import nextId from './nextId';

function mkCtx() {
  const ctx: any = { env: {}, state: {}, fns: { db: {}, session: {}, agent: {}, llm: {}, markdown: {}, repl: {}, events: {} } };
  ctx.fns.db.connect = connect;
  ctx.fns.db.migrate = migrate;
  ctx.fns.db.exec = (c: any, sql: string, params: any) => { const q = c.state.db.query(sql); const res = Array.isArray(params) ? q.run(...params) : q.run(params); return { changes: Number(res.changes ?? c.state.db.changes ?? 0), lastInsertRowid: Number(res.lastInsertRowid ?? 0) }; };
  ctx.fns.db.select = (c: any, sql: string, params: any = []) => { const q = c.state.db.query(sql); return Array.isArray(params) ? q.all(...params) : q.all(params); };
  ctx.fns.session.save = save; ctx.fns.session.load = load; ctx.fns.session.appendMessage = appendMessage; ctx.fns.session.appendEvent = appendEvent; ctx.fns.session.getMessages = getMessages; ctx.fns.session.getFullMessages = getFullMessages; ctx.fns.session.getEvents = getEvents; ctx.fns.session.syncAgentState = (c: any, a: any) => { a.messages = a.parentId ? c.fns.session.getFullMessages(c, a.id) : c.fns.session.getMessages(c, a.id); a.events = c.fns.session.getEvents(c, a.id); return a; }; ctx.fns.session.appendUserMessage = (c: any, id: string, text: string) => c.fns.session.appendMessage(c, id, { role: 'user', content: text }); ctx.fns.session.appendAssistantMessage = (c: any, id: string, msg: any) => c.fns.session.appendMessage(c, id, { role: 'assistant', ...(msg.content ? { content: msg.content } : {}), ...(msg.tool_calls?.length ? { tool_calls: msg.tool_calls } : {}) }); ctx.fns.session.appendToolMessage = (c: any, id: string, toolCallId: string, content: string) => c.fns.session.appendMessage(c, id, { role: 'tool', tool_call_id: toolCallId, content }); ctx.fns.session.appendThinkingEvent = (c: any, id: string, text: string) => c.fns.session.appendEvent(c, id, { type: 'thinking', text }); ctx.fns.session.appendAssistantEvent = (c: any, id: string, payload: any) => c.fns.session.appendEvent(c, id, { type: 'assistant', ...payload }); ctx.fns.session.appendToolCallEvent = (c: any, id: string, payload: any) => c.fns.session.appendEvent(c, id, { type: 'tool_call', ...payload }); ctx.fns.session.appendErrorEvent = (c: any, id: string, error: string) => c.fns.session.appendEvent(c, id, { type: 'error', error });
  ctx.fns.markdown.highlight = async (_c: any, s: string) => s;
  ctx.fns.markdown.render = async (_c: any, s: string) => s;
  ctx.fns.events.emit = () => {};
  ctx.fns.agent.nextId = nextId;
  return ctx;
}

describe('agent.run db-first groundwork', () => {
  test('persists user/tool/assistant messages to db during run', async () => {

    const ctx: any = mkCtx();
    ctx.fns.db.connect(ctx, ':memory:');
    await ctx.fns.db.migrate(ctx);
    ctx.fns.repl.eval = async (_c: any, code: string) => code === '2+2' ? 4 : 'ok';
    ctx.fns.llm.stream = async (_c: any, a: any) => {
      const msgs = ctx.fns.session.getFullMessages(ctx, a.id);
      const last = msgs[msgs.length - 1];
      if (last?.role === 'user') return { text: '', thinking: '', toolCalls: [{ id: 'c1', name: 'evalCode', arguments: JSON.stringify({ code: '2+2' }) }], usage: { prompt_tokens: 10 } };
      return { text: '4', thinking: '', toolCalls: [], usage: { prompt_tokens: 12 } };
    };
    const agent = start(ctx, { model: 'm', systemPrompt: '', tools: [{ name: 'evalCode' }] });
    save(ctx, agent);
    await run(ctx, agent, 'calc');
    const msgs = getMessages(ctx, agent.id, { includeExcluded: true });
    expect(msgs.map((m: any) => m.role)).toEqual(['user', 'assistant', 'tool', 'assistant']);
    const evs = getEvents(ctx, agent.id);
    expect(evs.map((e: any) => e.type)).toContain('assistant');
    expect(agent.messages.map((m: any) => m.role)).toEqual(['user', 'assistant', 'tool', 'assistant']);
  });

  test('fork child full messages include parent when llm reads from db', async () => {

    const ctx: any = mkCtx();
    ctx.fns.db.connect(ctx, ':memory:');
    await ctx.fns.db.migrate(ctx);
    const parent = start(ctx, { model: 'm', systemPrompt: '', tools: [] });
    save(ctx, parent);
    appendMessage(ctx, parent.id, { role: 'user', content: 'parent hello' });
    const child = start(ctx, { model: 'm', systemPrompt: '', tools: [], parentId: parent.id, forkOffset: 1 });
    save(ctx, child);
    expect(getFullMessages(ctx, child.id).map((m: any) => m.content)).toEqual(['parent hello']);
  });

  test('keeps failed eval in history but excludes it from future llm transcript after next success', async () => {

    const ctx: any = mkCtx();
    ctx.fns.db.connect(ctx, ':memory:');
    await ctx.fns.db.migrate(ctx);

    const seenTranscripts: any[] = [];
    ctx.fns.repl.eval = async (_c: any, code: string) => {
      if (code === 'bad()') throw new Error('boom');
      if (code === '2+2') return 4;
      return 'ok';
    };
    ctx.fns.llm.stream = async (_c: any, a: any) => {
      const msgs = ctx.fns.session.getFullMessages(ctx, a.id);
      seenTranscripts.push(msgs.map((m: any) => ({ role: m.role, content: m.content, tool_call_id: m.tool_call_id, tool_calls: m.tool_calls })));
      const last = msgs[msgs.length - 1];
      if (last?.role === 'user') return { text: '', thinking: '', toolCalls: [{ id: 'c1', name: 'evalCode', arguments: JSON.stringify({ code: 'bad()' }) }], usage: {} };
      if (last?.role === 'tool' && String(last.content).startsWith('Error:')) return { text: '', thinking: '', toolCalls: [{ id: 'c2', name: 'evalCode', arguments: JSON.stringify({ code: '2+2' }) }], usage: {} };
      return { text: 'done', thinking: '', toolCalls: [], usage: {} };
    };

    const agent = start(ctx, { model: 'm', systemPrompt: '', tools: [{ name: 'evalCode' }] });
    save(ctx, agent);
    await run(ctx, agent, 'calc');

    const allMsgs = getMessages(ctx, agent.id, { includeExcluded: true });
    expect(allMsgs.map((m: any) => m.role)).toEqual(['user', 'assistant', 'tool', 'assistant', 'tool', 'assistant']);
    expect(allMsgs[1].excluded_from_llm).toBe(true);
    expect(allMsgs[2].excluded_from_llm).toBe(true);
    expect(allMsgs[3].excluded_from_llm).toBeUndefined();
    expect(allMsgs[4].excluded_from_llm).toBeUndefined();

    const visibleMsgs = getMessages(ctx, agent.id);
    expect(visibleMsgs.map((m: any) => m.role)).toEqual(['user', 'assistant', 'tool', 'assistant']);
    expect(visibleMsgs[1].tool_calls[0].id).toBe('c2');
    expect(visibleMsgs[2].tool_call_id).toBe('c2');

    expect(seenTranscripts).toHaveLength(3);
    expect(seenTranscripts[1].map((m: any) => m.role)).toEqual(['user', 'assistant', 'tool']);
    expect(seenTranscripts[2].map((m: any) => m.role)).toEqual(['user', 'assistant', 'tool']);
    expect(seenTranscripts[2][1].tool_calls[0].id).toBe('c2');
    expect(String(seenTranscripts[2][2].content)).toBe('4');
  });
});
