import { describe, test, expect } from 'bun:test';
import route from './$route_$id_events.html_GET';
import wakeWaiters from './wakeWaiters';
import waitForEvent from './waitForEvent';
import getEvents from '../session/getEvents';
import getMaxEventIdx from '../session/getMaxEventIdx';
import appendEvent from '../session/appendEvent';
import save from '../session/save';
import start from './start';
import connect from '../db/connect';
import migrate from '../db/migrate';
import renderEventHtml from './renderEventHtml';

function mkCtx() {
    const ctx: any = { state: {}, env: {}, fns: { db: {}, session: {}, agent: {}, markdown: {} } };
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
    ctx.fns.session.appendEvent = appendEvent;
    ctx.fns.session.getEvents = getEvents;
    ctx.fns.session.getMaxEventIdx = getMaxEventIdx;
    ctx.fns.agent.wakeWaiters = wakeWaiters;
    ctx.fns.agent.waitForEvent = waitForEvent;
    ctx.fns.agent.renderEventHtml = renderEventHtml;
    ctx.fns.agent.nextId = (() => {
        let i = 0;
        const ids = ['a', 'b', 'c', 'd', 'e'];
        return () => ids[i++] ?? 'z';
    })();
    ctx.fns.markdown.highlight = async (_c: any, s: string) => String(s);
    return ctx;
}

function reqFor(id: string, offset: number) {
    const r = new Request('http://x/agent/' + id + '/events.html?offset=' + offset);
    (r as any).params = { id };
    return r;
}

describe('GET /agent/:id/events.html', () => {
    test('404 for unknown agent', async () => {
        const ctx = mkCtx();
        ctx.fns.db.connect(ctx, ':memory:');
        await ctx.fns.db.migrate(ctx);
        const res = await route(ctx, null, reqFor('nope', 0));
        expect(res.status).toBe(404);
    });

    test('returns events at offset and a tail with next offset', async () => {
        const ctx = mkCtx();
        ctx.fns.db.connect(ctx, ':memory:');
        await ctx.fns.db.migrate(ctx);
        const a = start(ctx, { model: 'm', systemPrompt: '' });
        save(ctx, a);
        appendEvent(ctx, a.id, { type: 'user', text: 'hi', html: '<div data-ev="user">hi</div>' });
        appendEvent(ctx, a.id, { type: 'user', text: 'two', html: '<div data-ev="user">two</div>' });

        const res = await route(ctx, null, reqFor(a.id, 0));
        const body = await res.text();
        expect(body).toContain('data-ev="user">hi');
        expect(body).toContain('data-ev="user">two');
        expect(body).toContain('id="msg-tail"');
        expect(body).toContain(`offset=2`);
    });

    test('returns only delta when offset is in the middle', async () => {
        const ctx = mkCtx();
        ctx.fns.db.connect(ctx, ':memory:');
        await ctx.fns.db.migrate(ctx);
        const a = start(ctx, { model: 'm', systemPrompt: '' });
        save(ctx, a);
        appendEvent(ctx, a.id, { type: 'user', text: 'a', html: '<div>a</div>' });
        appendEvent(ctx, a.id, { type: 'user', text: 'b', html: '<div>b</div>' });
        appendEvent(ctx, a.id, { type: 'user', text: 'c', html: '<div>c</div>' });

        const res = await route(ctx, null, reqFor(a.id, 2));
        const body = await res.text();
        expect(body).toContain('<div>c</div>');
        expect(body).not.toContain('<div>a</div>');
        expect(body).not.toContain('<div>b</div>');
        expect(body).toContain('offset=3');
    });

    test('long-polls until wake fires, then returns new event', async () => {
        const ctx = mkCtx();
        ctx.fns.db.connect(ctx, ':memory:');
        await ctx.fns.db.migrate(ctx);
        const a = start(ctx, { model: 'm', systemPrompt: '' });
        save(ctx, a);

        // Start long-poll at "tail" offset. No events yet, so it should wait.
        const pending = route(ctx, null, reqFor(a.id, 0));

        // After 30ms, append an event. appendEvent calls wakeWaiters internally.
        setTimeout(() => {
            appendEvent(ctx, a.id, { type: 'user', text: 'late', html: '<div>late</div>' });
        }, 30);

        const res = await pending;
        const body = await res.text();
        expect(body).toContain('<div>late</div>');
        expect(body).toContain('offset=1');
    });

    test('long-poll responds with empty delta on abort', async () => {
        const ctx = mkCtx();
        ctx.fns.db.connect(ctx, ':memory:');
        await ctx.fns.db.migrate(ctx);
        const a = start(ctx, { model: 'm', systemPrompt: '' });
        save(ctx, a);
        const ac = new AbortController();
        const r = new Request('http://x/agent/' + a.id + '/events.html?offset=0', { signal: ac.signal });
        (r as any).params = { id: a.id };
        const pending = route(ctx, null, r);
        setTimeout(() => ac.abort(), 30);
        const res = await pending;
        const body = await res.text();
        // No events delta, but tail still emitted with same offset 0.
        expect(body).toContain('id="msg-tail"');
        expect(body).toContain('offset=0');
    });
});
