import { describe, test, expect } from 'bun:test';
import waitForEventFn from './waitForEvent';
import wakeWaitersFn from './wakeWaiters';

const waitForEvent = (ctx: any, agentId: string, timeoutMs: number, signal?: AbortSignal) =>
    waitForEventFn(ctx, { agentId, timeoutMs, signal });
const wakeWaiters = (ctx: any, agentId: string) => wakeWaitersFn(ctx, { agentId });

function mkCtx() {
    return { state: {}, env: {}, fns: {} } as unknown as Context;
}

describe('agent.waitForEvent / wakeWaiters', () => {
    test('resolves with woken=false on timeout when no signal', async () => {
        const ctx = mkCtx();
        const t0 = Date.now();
        const res = await waitForEvent(ctx, 'a1', 50);
        expect(Date.now() - t0).toBeGreaterThanOrEqual(40);
        expect(res.woken).toBe(false);
    });

    test('resolves with woken=true when wakeWaiters fires for matching agent', async () => {
        const ctx = mkCtx();
        const p = waitForEvent(ctx, 'a1', 5_000);
        // Schedule wake on next tick.
        queueMicrotask(() => wakeWaiters(ctx, 'a1'));
        const res = await p;
        expect(res.woken).toBe(true);
    });

    test('wakeWaiters is scoped per agent', async () => {
        const ctx = mkCtx();
        const a = waitForEvent(ctx, 'a1', 100);
        const b = waitForEvent(ctx, 'a2', 5_000);
        wakeWaiters(ctx, 'a2'); // should resolve only b
        const bRes = await b;
        const aRes = await a;
        expect(bRes.woken).toBe(true);
        expect(aRes.woken).toBe(false); // timed out
    });

    test('AbortSignal cleans up the waiter', async () => {
        const ctx = mkCtx();
        const ac = new AbortController();
        const p = waitForEvent(ctx, 'a1', 5_000, ac.signal);
        ac.abort();
        const res = await p;
        expect(res.woken).toBe(false);
        // Map should not retain the resolver.
        const map: Map<string, Set<() => void>> = (ctx.state as any).eventWaiters;
        expect(map.get('a1')).toBeUndefined();
    });

    test('wakeWaiters returns count and clears the set', () => {
        const ctx = mkCtx();
        // No waiters yet.
        expect(wakeWaiters(ctx, 'a1')).toBe(0);
        // Stage two waiters.
        const p1 = waitForEvent(ctx, 'a1', 5_000);
        const p2 = waitForEvent(ctx, 'a1', 5_000);
        const n = wakeWaiters(ctx, 'a1');
        expect(n).toBe(2);
        return Promise.all([p1, p2]).then(([r1, r2]) => {
            expect(r1.woken).toBe(true);
            expect(r2.woken).toBe(true);
        });
    });
});
