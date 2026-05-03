import { describe, test, expect } from 'bun:test';
import connect from '../db/connect';
import migrate from '../db/migrate';
import save from './save';
import appendEvent from './appendEvent';
import getEvents from './getEvents';
import getMaxEventIdx from './getMaxEventIdx';
import start from '../agent/start';
import nextId from '../agent/nextId';

function mkCtx() {
    const ctx: any = { env: {}, state: {}, fns: { db: {}, session: {}, agent: { nextId } } };
    ctx.fns.db.connect = connect;
    ctx.fns.db.migrate = migrate;
    ctx.fns.db.exec = (c: any, opts: { sql: string; params?: any }) => {
        const params = opts.params ?? [];
        const q = c.state.db.query(opts.sql);
        const res = Array.isArray(params) ? q.run(...params) : q.run(params);
        return { changes: Number(res.changes ?? c.state.db.changes ?? 0), lastInsertRowid: Number(res.lastInsertRowid ?? 0) };
    };
    ctx.fns.db.select = (c: any, opts: { sql: string; params?: any }) => {
        const params = opts.params ?? [];
        const q = c.state.db.query(opts.sql);
        return Array.isArray(params) ? q.all(...params) : q.all(params);
    };
    return ctx;
}

describe('session.getMaxEventIdx & getEvents(opts)', () => {
    test('returns -1 when no events', async () => {
        const ctx = mkCtx();
        ctx.fns.db.connect(ctx, { path: ':memory:' });
        await ctx.fns.db.migrate(ctx);
        const a = start(ctx, { model: 'm', systemPrompt: '' });
        save(ctx, { agent: a });
        expect(getMaxEventIdx(ctx, { id: a.id })).toBe(-1);
    });

    test('idx grows monotonically', async () => {
        const ctx = mkCtx();
        ctx.fns.db.connect(ctx, { path: ':memory:' });
        await ctx.fns.db.migrate(ctx);
        const a = start(ctx, { model: 'm', systemPrompt: '' });
        save(ctx, { agent: a });
        const r1 = appendEvent(ctx, { id: a.id, event: { type: 'user', text: 'hi' } });
        const r2 = appendEvent(ctx, { id: a.id, event: { type: 'thinking', text: '...' } });
        const r3 = appendEvent(ctx, { id: a.id, event: { type: 'assistant', text: 'hi back' } });
        expect(r1.idx).toBe(0);
        expect(r2.idx).toBe(1);
        expect(r3.idx).toBe(2);
        expect(getMaxEventIdx(ctx, { id: a.id })).toBe(2);
    });

    test('getEvents fromIdx slices correctly', async () => {
        const ctx = mkCtx();
        ctx.fns.db.connect(ctx, { path: ':memory:' });
        await ctx.fns.db.migrate(ctx);
        const a = start(ctx, { model: 'm', systemPrompt: '' });
        save(ctx, { agent: a });
        appendEvent(ctx, { id: a.id, event: { type: 'user', text: 'one' } });
        appendEvent(ctx, { id: a.id, event: { type: 'user', text: 'two' } });
        appendEvent(ctx, { id: a.id, event: { type: 'user', text: 'three' } });

        expect(getEvents(ctx, { id: a.id }).map((e: any) => e.text)).toEqual(['one', 'two', 'three']);
        expect(getEvents(ctx, { id: a.id, fromIdx: 1 }).map((e: any) => e.text)).toEqual(['two', 'three']);
        expect(getEvents(ctx, { id: a.id, fromIdx: 3 })).toEqual([]);
        expect(getEvents(ctx, { id: a.id, fromIdx: 0, limit: 2 }).map((e: any) => e.text)).toEqual(['one', 'two']);
    });
});
