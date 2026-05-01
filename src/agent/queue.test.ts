import { describe, test, expect } from 'bun:test';
import { mkTestCtx } from '../_testCtx.entry';
import wakeWorker from './wakeWorker';

// The "queue" is just two columns on the agents row: next_run_at + run_state.
// POST /agent/:id sets next_run_at; workerLoop atomically claims via UPDATE ... RETURNING.

async function drainUntilIdle(ctx: any, deadlineMs = 5000) {
    const loop = ctx.fns.agent.workerLoop(ctx);
    const t0 = Date.now();
    while (Date.now() - t0 < deadlineMs) {
        const busy = ctx.fns.db.select(ctx,
            `SELECT COUNT(*) AS n FROM agents
              WHERE archived_at IS NULL
                AND (run_state = 'running' OR next_run_at IS NOT NULL)`,
        )[0]?.n ?? 0;
        if (Number(busy) === 0) break;
        await new Promise(r => setTimeout(r, 20));
    }
    ctx.state.workerLoopRunning = false;
    wakeWorker(ctx);
    await loop;
}

describe('agent queue (state on agents row)', () => {
    test('POST sets next_run_at, worker drains, advances cursor', async () => {
        const ctx = await mkTestCtx();
        const seen: string[] = [];
        ctx.fns.agent.run = async (_c: any, agent: any) => { seen.push(agent.id); };

        const a = ctx.fns.agent.start(ctx, { model: 'm' });
        ctx.fns.session.save(ctx, a);

        // Simulate POST: append messages and bump next_run_at.
        await ctx.fns.session.appendUserMessage(ctx, a.id, 'one');
        await ctx.fns.session.appendUserMessage(ctx, a.id, 'two');
        ctx.fns.db.exec(ctx, 'UPDATE agents SET next_run_at = ? WHERE id = ?', [Date.now(), a.id]);

        await drainUntilIdle(ctx);

        expect(seen).toEqual([a.id]);
        const row = ctx.fns.db.select(ctx, 'SELECT run_state, next_run_at, last_processed_msg_idx FROM agents WHERE id = ?', [a.id])[0];
        expect(row.run_state).toBe('idle');
        expect(row.next_run_at).toBeNull();
        expect(row.last_processed_msg_idx).toBe(1);
    });

    test('debounced run is held until next_run_at <= now', async () => {
        const ctx = await mkTestCtx();
        const seen: number[] = [];
        ctx.fns.agent.run = async () => { seen.push(Date.now()); };

        const a = ctx.fns.agent.start(ctx, { model: 'm' });
        ctx.fns.session.save(ctx, a);

        const t0 = Date.now();
        await ctx.fns.session.appendUserMessage(ctx, a.id, 'soon');
        ctx.fns.db.exec(ctx, 'UPDATE agents SET next_run_at = ? WHERE id = ?', [t0 + 150, a.id]);

        await drainUntilIdle(ctx, 1500);

        expect(seen.length).toBe(1);
        expect(seen[0]! - t0).toBeGreaterThanOrEqual(140);
    });

    test('multiple agents drained serially', async () => {
        const ctx = await mkTestCtx();
        const seen: string[] = [];
        ctx.fns.agent.run = async (_c: any, agent: any) => { seen.push(agent.id); };

        const a1 = ctx.fns.agent.start(ctx, { model: 'm' });
        const a2 = ctx.fns.agent.start(ctx, { model: 'm' });
        ctx.fns.session.save(ctx, a1);
        ctx.fns.session.save(ctx, a2);

        await ctx.fns.session.appendUserMessage(ctx, a1.id, 'a1');
        await ctx.fns.session.appendUserMessage(ctx, a2.id, 'a2');
        const now = Date.now();
        ctx.fns.db.exec(ctx, 'UPDATE agents SET next_run_at = ? WHERE id IN (?, ?)', [now, a1.id, a2.id]);

        await drainUntilIdle(ctx);

        expect(seen.sort()).toEqual([a1.id, a2.id].sort());
    });
});
