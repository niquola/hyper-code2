import { describe, test, expect } from 'bun:test';
import { mkTestCtx } from '../_testCtx.entry';
import wakeWorker from './wakeWorker';

// The "queue" is just two columns on the agents row: next_run_at + run_state.
// POST /agent/:id sets next_run_at; workerLoop atomically claims via UPDATE ... RETURNING.

async function drainUntilIdle(ctx: any, deadlineMs = 5000) {
    const loop = ctx.fns.agent.workerLoop({});
    const t0 = Date.now();
    while (Date.now() - t0 < deadlineMs) {
        const busy = (await ctx.fns.procs.db.select({
            sql: `SELECT COUNT(*) AS n FROM agents
              WHERE archived_at IS NULL
                AND (run_state = 'running' OR next_run_at IS NOT NULL)`,
        }))[0]?.n ?? 0;
        if (Number(busy) === 0) break;
        await new Promise(r => setTimeout(r, 20));
    }
    ctx.state.workerLoopRunning = false;
    wakeWorker(ctx, null);
    await loop;
}

describe('agent queue (state on agents row)', () => {
    test('POST sets next_run_at, worker drains, advances cursor', async () => {
        const ctx = await mkTestCtx();
        const seen: string[] = [];
        ctx.fns.agent.run = async (_c: any, _s: any, opts: any) => { seen.push(opts.agent.id); };

        const a = await ctx.fns.agent.start({ model: 'm' });
        await ctx.fns.session.save({ agent: a });

        // Simulate POST: append messages and bump next_run_at.
        await ctx.fns.session.appendUserMessage({ id: a.id, text: 'one' });
        await ctx.fns.session.appendUserMessage({ id: a.id, text: 'two' });
        await ctx.fns.procs.db.run({ sql: 'UPDATE agents SET next_run_at = ? WHERE id = ?', params: [Date.now(), a.id] });

        await drainUntilIdle(ctx);

        expect(seen).toEqual([a.id]);
        const row = (await ctx.fns.procs.db.select({ sql: 'SELECT run_state, next_run_at, last_processed_msg_idx FROM agents WHERE id = ?', params: [a.id] }))[0];
        expect(row.run_state).toBe('idle');
        expect(row.next_run_at).toBeNull();
        expect(row.last_processed_msg_idx).toBe(1);
    });

    test('debounced run is held until next_run_at <= now', async () => {
        const ctx = await mkTestCtx();
        const seen: number[] = [];
        ctx.fns.agent.run = async () => { seen.push(Date.now()); };

        const a = await ctx.fns.agent.start({ model: 'm' });
        await ctx.fns.session.save({ agent: a });

        const t0 = Date.now();
        await ctx.fns.session.appendUserMessage({ id: a.id, text: 'soon' });
        await ctx.fns.procs.db.run({ sql: 'UPDATE agents SET next_run_at = ? WHERE id = ?', params: [t0 + 150, a.id] });

        await drainUntilIdle(ctx, 1500);

        expect(seen.length).toBe(1);
        expect(seen[0]! - t0).toBeGreaterThanOrEqual(140);
    });

    test('multiple agents drained serially', async () => {
        const ctx = await mkTestCtx();
        const seen: string[] = [];
        ctx.fns.agent.run = async (_c: any, _s: any, opts: any) => { seen.push(opts.agent.id); };

        const a1 = await ctx.fns.agent.start({ model: 'm' });
        const a2 = await ctx.fns.agent.start({ model: 'm' });
        await ctx.fns.session.save({ agent: a1 });
        await ctx.fns.session.save({ agent: a2 });

        await ctx.fns.session.appendUserMessage({ id: a1.id, text: 'a1' });
        await ctx.fns.session.appendUserMessage({ id: a2.id, text: 'a2' });
        const now = Date.now();
        await ctx.fns.procs.db.run({ sql: 'UPDATE agents SET next_run_at = ? WHERE id IN (?, ?)', params: [now, a1.id, a2.id] });

        await drainUntilIdle(ctx);

        expect(seen.sort()).toEqual([a1.id, a2.id].sort());
    });

    test('cursor does NOT advance when run errors out', async () => {
        const ctx = await mkTestCtx();
        ctx.fns.agent.run = async () => { throw new Error('boom'); };

        const a = await ctx.fns.agent.start({ model: 'm' });
        await ctx.fns.session.save({ agent: a });

        await ctx.fns.session.appendUserMessage({ id: a.id, text: 'one' });
        await ctx.fns.session.appendUserMessage({ id: a.id, text: 'two' });
        await ctx.fns.procs.db.run({ sql: 'UPDATE agents SET next_run_at = ? WHERE id = ?', params: [Date.now(), a.id] });

        await drainUntilIdle(ctx);

        const row = (await ctx.fns.procs.db.select({
            sql: 'SELECT run_state, last_processed_msg_idx, last_error FROM agents WHERE id = ?',
            params: [a.id],
        }))[0];
        expect(row.run_state).toBe('idle');
        expect(row.last_error).toContain('boom');
        // Critical: cursor must stay at -1 (initial), NOT jump to 1 (max idx).
        // Otherwise the next successful run would skip messages "one" and "two".
        expect(row.last_processed_msg_idx).toBe(-1);
    });

    test('cursor does NOT advance when run is aborted', async () => {
        const ctx = await mkTestCtx();
        ctx.fns.agent.run = async () => {
            const err: any = new Error('AbortError: aborted');
            err.name = 'AbortError';
            throw err;
        };

        const a = await ctx.fns.agent.start({ model: 'm' });
        await ctx.fns.session.save({ agent: a });

        await ctx.fns.session.appendUserMessage({ id: a.id, text: 'one' });
        await ctx.fns.procs.db.run({ sql: 'UPDATE agents SET next_run_at = ? WHERE id = ?', params: [Date.now(), a.id] });

        await drainUntilIdle(ctx);

        const row = (await ctx.fns.procs.db.select({
            sql: 'SELECT run_state, last_processed_msg_idx FROM agents WHERE id = ?',
            params: [a.id],
        }))[0];
        expect(row.run_state).toBe('idle');
        // Aborted run: cursor stays at -1 so the message is retried on the next pass.
        expect(row.last_processed_msg_idx).toBe(-1);
    });

    test('successful run does NOT reschedule itself just because run() appended assistant/tool messages', async () => {
        // Regression: worker used to count assistant + tool messages as "new pending work"
        // and reschedule on every successful turn → infinite loop replying to the same user msg.
        const ctx = await mkTestCtx();
        const seenUserTexts: string[] = [];
        ctx.fns.agent.run = async (c: any, _s: any, opts: any) => {
            const agent = opts.agent;
            // Realistic: read full transcript, then append our assistant reply.
            const msgs = await c.fns.session.getMessages({ id: agent.id });
            for (const m of msgs) if (m.role === 'user') seenUserTexts.push(m.content);
            await c.fns.session.appendMessage({ id: agent.id, message: { role: 'assistant', content: 'reply' } });
        };

        const a = await ctx.fns.agent.start({ model: 'm' });
        await ctx.fns.session.save({ agent: a });
        await ctx.fns.session.appendUserMessage({ id: a.id, text: 'hello' });
        await ctx.fns.procs.db.run({ sql: 'UPDATE agents SET next_run_at = ? WHERE id = ?', params: [Date.now(), a.id] });

        await drainUntilIdle(ctx, 2000);

        // Run was called exactly ONCE — no infinite reschedule loop.
        expect(seenUserTexts).toEqual(['hello']);

        const row = (await ctx.fns.procs.db.select({ sql: 'SELECT run_state, next_run_at FROM agents WHERE id = ?', params: [a.id] }))[0];
        expect(row.run_state).toBe('idle');
        expect(row.next_run_at).toBeNull();
    });

    test('cursor advances past pre-existing messages on success (regression: backfill seeded cursor)', async () => {
        const ctx = await mkTestCtx();
        ctx.fns.agent.run = async () => { /* success */ };

        const a = await ctx.fns.agent.start({ model: 'm' });
        await ctx.fns.session.save({ agent: a });

        // Pre-existing: 2 messages already processed (e.g. a server restart).
        await ctx.fns.session.appendUserMessage({ id: a.id, text: 'old1' });
        await ctx.fns.session.appendUserMessage({ id: a.id, text: 'old2' });
        await ctx.fns.procs.db.run({ sql: 'UPDATE agents SET last_processed_msg_idx = ? WHERE id = ?', params: [1, a.id] });

        // New message arrives.
        await ctx.fns.session.appendUserMessage({ id: a.id, text: 'new' });
        await ctx.fns.procs.db.run({ sql: 'UPDATE agents SET next_run_at = ? WHERE id = ?', params: [Date.now(), a.id] });

        await drainUntilIdle(ctx);

        const row = (await ctx.fns.procs.db.select({ sql: 'SELECT last_processed_msg_idx FROM agents WHERE id = ?', params: [a.id] }))[0];
        expect(row.last_processed_msg_idx).toBe(2);
    });
});
