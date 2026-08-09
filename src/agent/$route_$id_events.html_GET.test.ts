import { describe, test, expect } from 'bun:test';
import { mkTestCtx } from '../_testCtx.entry';

async function mkAgent(ctx: any) {
    const agent = await ctx.fns.agent.start({ model: 'm', systemPrompt: '' });
    await ctx.fns.session.save({ agent });
    return agent;
}

describe('GET /agent/:id/events.html', () => {
    test('404 for unknown agent', async () => {
        const ctx = await mkTestCtx();
        const res = await ctx.fns.procs.http.dispatch({ url: '/agent/nope/events.html?offset=0' });
        expect(res.status).toBe(404);
    });

    test('returns events at offset and a tail with next offset', async () => {
        const ctx = await mkTestCtx();
        const a = await mkAgent(ctx);
        await ctx.fns.session.appendEvent({ id: a.id, event: { type: 'user', text: 'hi', html: '<div data-ev="user">hi</div>' } });
        await ctx.fns.session.appendEvent({ id: a.id, event: { type: 'user', text: 'two', html: '<div data-ev="user">two</div>' } });

        const res = await ctx.fns.procs.http.dispatch({ url: `/agent/${a.id}/events.html?offset=0` });
        const body = await res.text();
        expect(body).toContain('data-ev="user">hi');
        expect(body).toContain('data-ev="user">two');
        expect(body).toContain('id="msg-tail"');
        expect(body).toContain(`offset=2`);
    });

    test('returns only delta when offset is in the middle', async () => {
        const ctx = await mkTestCtx();
        const a = await mkAgent(ctx);
        await ctx.fns.session.appendEvent({ id: a.id, event: { type: 'user', text: 'a', html: '<div>a</div>' } });
        await ctx.fns.session.appendEvent({ id: a.id, event: { type: 'user', text: 'b', html: '<div>b</div>' } });
        await ctx.fns.session.appendEvent({ id: a.id, event: { type: 'user', text: 'c', html: '<div>c</div>' } });

        const res = await ctx.fns.procs.http.dispatch({ url: `/agent/${a.id}/events.html?offset=2` });
        const body = await res.text();
        expect(body).toContain('<div>c</div>');
        expect(body).not.toContain('<div>a</div>');
        expect(body).not.toContain('<div>b</div>');
        expect(body).toContain('offset=3');
    });

    test('returns instantly with empty delta + tail (no long-poll)', async () => {
        // After the SSE refactor: handler is short-fetch, never blocks on
        // waitForEvent. The browser triggers the next fetch via
        // hyper-tick (dispatched by events/client.js on
        // agent.event_appended SSE) or the 10s safety poll.
        const ctx = await mkTestCtx();
        const a = await mkAgent(ctx);

        const t0 = Date.now();
        const res = await ctx.fns.procs.http.dispatch({ url: `/agent/${a.id}/events.html?offset=0` });
        const wall = Date.now() - t0;
        expect(wall).toBeLessThan(50);

        const body = await res.text();
        expect(body).toContain('id="msg-tail"');
        expect(body).toContain('hyper-tick from:body, every 10s');
        expect(body).toContain('offset=0');
    });
});
