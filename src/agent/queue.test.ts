import { describe, test, expect } from 'bun:test';
import connect from '../db/connect';
import migrate from '../db/migrate';
import enqueue from './enqueue';
import workerLoop from './workerLoop';
import wakeWorker from './wakeWorker';
import stop from './stop';
import start from './start';
import appendMessage from '../session/appendMessage';
import appendEvent from '../session/appendEvent';
import getMessages from '../session/getMessages';
import getFullMessages from '../session/getFullMessages';
import save from '../session/save';
import load from '../session/load';

function mkCtx() {
  const ctx: any = { env: {}, state: {}, fns: { db: {}, session: {}, agent: {}, llm: {}, markdown: {}, repl: {}, events: {} } };
  ctx.fns.db.connect = connect;
  ctx.fns.db.migrate = migrate;
  ctx.fns.db.exec = (c: any, sql: string, params: any) => {
    const q = c.state.db.query(sql);
    const res = Array.isArray(params) ? q.run(...params) : q.run(params);
    return { changes: Number(res.changes ?? c.state.db.changes ?? 0), lastInsertRowid: Number(res.lastInsertRowid ?? 0) };
  };
  ctx.fns.db.select = (c: any, sql: string, params: any = []) => {
    const q = c.state.db.query(sql);
    return Array.isArray(params) ? q.all(...params) : q.all(params);
  };
  ctx.fns.session.save = save;
  ctx.fns.session.load = load;
  ctx.fns.session.appendMessage = appendMessage;
  ctx.fns.session.appendEvent = appendEvent;
  ctx.fns.session.getMessages = getMessages;
  ctx.fns.session.getFullMessages = getFullMessages;
  ctx.fns.session.syncAgentState = (c: any, a: any) => {
    a.messages = a.parentId ? c.fns.session.getFullMessages(c, a.id) : c.fns.session.getMessages(c, a.id);
    return a;
  };
  ctx.fns.session.appendUserMessage = async (c: any, id: string, text: string) => c.fns.session.appendMessage(c, id, { role: 'user', content: text });
  ctx.fns.session.appendAssistantMessage = (c: any, id: string, msg: any) => c.fns.session.appendMessage(c, id, { role: 'assistant', ...(msg.content ? { content: msg.content } : {}), ...(msg.tool_calls?.length ? { tool_calls: msg.tool_calls } : {}) });
  ctx.fns.session.appendToolMessage = (c: any, id: string, toolCallId: string, content: string) => c.fns.session.appendMessage(c, id, { role: 'tool', tool_call_id: toolCallId, content });
  ctx.fns.session.appendAssistantEvent = async () => {};
  ctx.fns.session.appendToolCallEvent = async () => {};
  ctx.fns.session.appendErrorEvent = async () => {};
  ctx.fns.markdown.highlight = async (_c: any, s: string) => s;
  ctx.fns.markdown.render = async (_c: any, s: string) => s;
  ctx.fns.events.emit = () => {};
  ctx.fns.agent.enqueue = enqueue;
  ctx.fns.agent.workerLoop = workerLoop;
  ctx.fns.agent.wakeWorker = wakeWorker;
  ctx.fns.agent.stop = stop;
  return ctx;
}

describe('agent queue (single workerLoop)', () => {
  test('one user message -> one job, no merge', async () => {
    const ctx: any = mkCtx();
    ctx.fns.db.connect(ctx, ':memory:');
    await ctx.fns.db.migrate(ctx);

    const agent = start(ctx, { model: 'm', systemPrompt: '', tools: [] });
    save(ctx, agent);

    const m1 = await ctx.fns.session.appendUserMessage(ctx, agent.id, 'one');
    const j1 = enqueue(ctx, agent, 'one', { debounceSeconds: 0, messageIdx: m1.idx });
    const m2 = await ctx.fns.session.appendUserMessage(ctx, agent.id, 'two');
    const j2 = enqueue(ctx, agent, 'two', { debounceSeconds: 0, messageIdx: m2.idx });

    expect(j1.id).not.toBe(j2.id);

    const jobs = ctx.fns.db.select(ctx, 'SELECT id, status, payload_json FROM agent_jobs WHERE agent_id = ? ORDER BY created_at ASC', [agent.id]);
    expect(jobs.map((j: any) => j.status)).toEqual(['queued', 'queued']);
    expect(JSON.parse(jobs[0].payload_json).text).toBe('one');
    expect(JSON.parse(jobs[1].payload_json).text).toBe('two');
  });

  test('workerLoop completes queued jobs serially across agents', async () => {
    const ctx: any = mkCtx();
    ctx.fns.db.connect(ctx, ':memory:');
    await ctx.fns.db.migrate(ctx);

    const seen: string[] = [];
    ctx.fns.agent.run = async (_c: any, _agent: any, text: string) => { seen.push(text); };

    const a1 = start(ctx, { model: 'm', systemPrompt: '', tools: [] });
    const a2 = start(ctx, { model: 'm', systemPrompt: '', tools: [] });
    save(ctx, a1);
    save(ctx, a2);

    enqueue(ctx, a1, 'a1.one', { debounceSeconds: 0 });
    enqueue(ctx, a2, 'a2.one', { debounceSeconds: 0 });
    enqueue(ctx, a1, 'a1.two', { debounceSeconds: 0 });

    // Run worker until queue is empty, then signal it to exit.
    const loop = ctx.fns.agent.workerLoop(ctx);
    // Poll until everything is done, then stop the loop.
    const t0 = Date.now();
    while (Date.now() - t0 < 5000) {
      const remaining = ctx.fns.db.select(ctx, "SELECT COUNT(*) AS n FROM agent_jobs WHERE status IN ('queued','running')")[0]?.n ?? 0;
      if (Number(remaining) === 0) break;
      await new Promise(r => setTimeout(r, 20));
    }
    (ctx.state as any).workerLoopRunning = false;
    wakeWorker(ctx);
    await loop;

    expect(seen.sort()).toEqual(['a1.one', 'a1.two', 'a2.one'].sort());
    const jobs = ctx.fns.db.select(ctx, 'SELECT status FROM agent_jobs ORDER BY created_at ASC');
    expect(jobs.map((r: any) => r.status)).toEqual(['done', 'done', 'done']);
  });

  test('debounced job is held until debounce_until <= now', async () => {
    const ctx: any = mkCtx();
    ctx.fns.db.connect(ctx, ':memory:');
    await ctx.fns.db.migrate(ctx);

    const seen: number[] = [];
    ctx.fns.agent.run = async () => { seen.push(Date.now()); };

    const a = start(ctx, { model: 'm', systemPrompt: '', tools: [] });
    save(ctx, a);

    const t0 = Date.now();
    enqueue(ctx, a, 'soon', { debounceSeconds: 0.15 }); // ~150ms
    const loop = ctx.fns.agent.workerLoop(ctx);

    // Wait until job runs (max 1s)
    while (Date.now() - t0 < 1000 && seen.length === 0) {
      await new Promise(r => setTimeout(r, 20));
    }
    (ctx.state as any).workerLoopRunning = false;
    wakeWorker(ctx);
    await loop;

    expect(seen.length).toBe(1);
    expect(seen[0]! - t0).toBeGreaterThanOrEqual(140);
  });
});
