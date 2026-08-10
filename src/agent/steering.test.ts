import { describe, test, expect } from 'bun:test';
import { mkTestCtx } from '../_testCtx.entry';
import wakeWorker from './wakeWorker';

async function drainUntilIdle(ctx: any, deadlineMs = 5000) {
    const loop = ctx.fns.agent.workerLoop({});
    const t0 = Date.now();
    while (Date.now() - t0 < deadlineMs) {
        const busy = (await ctx.fns.procs.db.select({
            sql: `SELECT COUNT(*) AS n FROM agents WHERE archived_at IS NULL AND (run_state = 'running' OR next_run_at IS NOT NULL)`,
        }))[0]?.n ?? 0;
        if (Number(busy) === 0) break;
        await new Promise(r => setTimeout(r, 20));
    }
    ctx.state.workerLoopRunning = false;
    wakeWorker(ctx, null);
    await loop;
}

describe('steering: mid-run user message joins the CURRENT run', () => {
    test('steered message reaches the next model call; no duplicate run after', async () => {
        const ctx = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: 'mock:echo' });
        await ctx.fns.session.save({ agent });

        const streamSaw: string[][] = [];
        let call = 0;
        ctx.state.registry.repl.eval = async () => 'ran';
        ctx.state.registry.llm.stream = async (_c: any, _s: any, o: any) => {
            streamSaw.push(o.agent.messages.filter((m: any) => m.role === 'user').map((m: any) => String(m.content)));
            if (++call === 1) {
                // Mid-run POST: lands while the "model" is between marker and next call.
                await ctx.fns.session.appendUserMessage({ id: agent.id, text: 'steer!' });
                await ctx.fns.procs.db.run({
                    sql: 'UPDATE agents SET next_run_at = GREATEST(COALESCE(next_run_at, 0), ?) WHERE id = ?',
                    params: [Date.now(), agent.id],
                });
                return { text: '§eval\nconsole.log(1)', usage: {}, finishReason: 'stop' };
            }
            return { text: 'answered both.', usage: {}, finishReason: 'stop' };
        };

        await ctx.fns.session.appendUserMessage({ id: agent.id, text: 'first' });
        await ctx.fns.procs.db.run({ sql: 'UPDATE agents SET next_run_at = ? WHERE id = ?', params: [Date.now(), agent.id] });

        await drainUntilIdle(ctx);

        expect(call).toBe(2);                                         // ONE run, two model calls — no second pass
        expect(streamSaw[1]!.some(t => t.includes('steer!'))).toBe(true);  // steered msg was IN the second call
        const row = (await ctx.fns.procs.db.select({ sql: 'SELECT next_run_at, last_processed_msg_idx FROM agents WHERE id = ?', params: [agent.id] }))[0];
        expect(row.next_run_at).toBeNull();                           // nothing left pending
        expect(Number(row.last_processed_msg_idx)).toBeGreaterThanOrEqual(1);  // cursor covers the steered msg
    });

    test('message arriving AFTER the final model call still triggers a fresh run', async () => {
        const ctx = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: 'mock:echo' });
        await ctx.fns.session.save({ agent });
        let runs = 0;
        ctx.state.registry.llm.stream = async () => {
            runs++;
            if (runs === 1) {
                // Lands after this (final, prose-only) call is already streaming —
                // the run never sees it, so the worker must schedule another pass.
                await ctx.fns.session.appendUserMessage({ id: agent.id, text: 'too late for this run' });
                await ctx.fns.procs.db.run({
                    sql: 'UPDATE agents SET next_run_at = GREATEST(COALESCE(next_run_at, 0), ?) WHERE id = ?',
                    params: [Date.now(), agent.id],
                });
            }
            return { text: 'done.', usage: {}, finishReason: 'stop' };
        };
        await ctx.fns.session.appendUserMessage({ id: agent.id, text: 'first' });
        await ctx.fns.procs.db.run({ sql: 'UPDATE agents SET next_run_at = ? WHERE id = ?', params: [Date.now(), agent.id] });

        await drainUntilIdle(ctx);
        expect(runs).toBe(2);                                          // second run picked it up
    });
});
