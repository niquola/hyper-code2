import { describe, test, expect } from 'bun:test';
import { mkTestCtx } from '../_testCtx.entry';

describe('session.getMaxEventIdx & getEvents(opts)', () => {
    test('returns -1 when no events', async () => {
        const ctx: any = await mkTestCtx();
        const a = await ctx.fns.agent.start({ model: 'm', systemPrompt: '' });
        await ctx.fns.session.save({ agent: a });
        expect(await ctx.fns.session.getMaxEventIdx({ id: a.id })).toBe(-1);
    });

    test('idx grows monotonically', async () => {
        const ctx: any = await mkTestCtx();
        const a = await ctx.fns.agent.start({ model: 'm', systemPrompt: '' });
        await ctx.fns.session.save({ agent: a });
        const r1 = await ctx.fns.session.appendEvent({ id: a.id, event: { type: 'user', text: 'hi' } });
        const r2 = await ctx.fns.session.appendEvent({ id: a.id, event: { type: 'thinking', text: '...' } });
        const r3 = await ctx.fns.session.appendEvent({ id: a.id, event: { type: 'assistant', text: 'hi back' } });
        expect(r1.idx).toBe(0);
        expect(r2.idx).toBe(1);
        expect(r3.idx).toBe(2);
        expect(await ctx.fns.session.getMaxEventIdx({ id: a.id })).toBe(2);
    });

    test('getEvents fromIdx slices correctly', async () => {
        const ctx: any = await mkTestCtx();
        const a = await ctx.fns.agent.start({ model: 'm', systemPrompt: '' });
        await ctx.fns.session.save({ agent: a });
        await ctx.fns.session.appendEvent({ id: a.id, event: { type: 'user', text: 'one' } });
        await ctx.fns.session.appendEvent({ id: a.id, event: { type: 'user', text: 'two' } });
        await ctx.fns.session.appendEvent({ id: a.id, event: { type: 'user', text: 'three' } });

        expect((await ctx.fns.session.getEvents({ id: a.id })).map((e: any) => e.text)).toEqual(['one', 'two', 'three']);
        expect((await ctx.fns.session.getEvents({ id: a.id, fromIdx: 1 })).map((e: any) => e.text)).toEqual(['two', 'three']);
        expect(await ctx.fns.session.getEvents({ id: a.id, fromIdx: 3 })).toEqual([]);
        expect((await ctx.fns.session.getEvents({ id: a.id, fromIdx: 0, limit: 2 })).map((e: any) => e.text)).toEqual(['one', 'two']);
    });
});
