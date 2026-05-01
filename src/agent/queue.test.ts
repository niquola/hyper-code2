import { describe, test, expect } from 'bun:test';
import { mkTestCtx } from '../_testCtx.entry';
import enqueue from './enqueue';
import wakeWorker from './wakeWorker';

describe('agent queue (single workerLoop)', () => {
  test('one user message -> one job, no merge', async () => {
    const ctx = await mkTestCtx();

    const agent = ctx.fns.agent.start(ctx, { model: 'm', systemPrompt: '', tools: [] });
    ctx.fns.session.save(ctx, agent);

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
    const ctx = await mkTestCtx();
    const seen: string[] = [];
    ctx.fns.agent.run = async (_c: any, _agent: any, text: string) => { seen.push(text); };

    const a1 = ctx.fns.agent.start(ctx, { model: 'm', systemPrompt: '', tools: [] });
    const a2 = ctx.fns.agent.start(ctx, { model: 'm', systemPrompt: '', tools: [] });
    ctx.fns.session.save(ctx, a1);
    ctx.fns.session.save(ctx, a2);

    enqueue(ctx, a1, 'a1.one', { debounceSeconds: 0 });
    enqueue(ctx, a2, 'a2.one', { debounceSeconds: 0 });
    enqueue(ctx, a1, 'a1.two', { debounceSeconds: 0 });

    const loop = ctx.fns.agent.workerLoop(ctx);
    const t0 = Date.now();
    while (Date.now() - t0 < 5000) {
      const remaining = ctx.fns.db.select(ctx, "SELECT COUNT(*) AS n FROM agent_jobs WHERE status IN ('queued','running')")[0]?.n ?? 0;
      if (Number(remaining) === 0) break;
      await new Promise(r => setTimeout(r, 20));
    }
    ctx.state.workerLoopRunning = false;
    wakeWorker(ctx);
    await loop;

    expect(seen.sort()).toEqual(['a1.one', 'a1.two', 'a2.one'].sort());
    const jobs = ctx.fns.db.select(ctx, 'SELECT status FROM agent_jobs ORDER BY created_at ASC');
    expect(jobs.map((r: any) => r.status)).toEqual(['done', 'done', 'done']);
  });

  test('debounced job is held until debounce_until <= now', async () => {
    const ctx = await mkTestCtx();
    const seen: number[] = [];
    ctx.fns.agent.run = async () => { seen.push(Date.now()); };

    const a = ctx.fns.agent.start(ctx, { model: 'm', systemPrompt: '', tools: [] });
    ctx.fns.session.save(ctx, a);

    const t0 = Date.now();
    enqueue(ctx, a, 'soon', { debounceSeconds: 0.15 });
    const loop = ctx.fns.agent.workerLoop(ctx);

    while (Date.now() - t0 < 1000 && seen.length === 0) {
      await new Promise(r => setTimeout(r, 20));
    }
    ctx.state.workerLoopRunning = false;
    wakeWorker(ctx);
    await loop;

    expect(seen.length).toBe(1);
    expect(seen[0]! - t0).toBeGreaterThanOrEqual(140);
  });
});
