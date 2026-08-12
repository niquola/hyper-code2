import { describe, expect, test } from 'bun:test';
import { mkTestCtx } from '../_testCtx.entry';

async function seed(ctx: any, event: any) {
    const agent = await ctx.fns.agent.start({ model: 'mock:test' });
    await ctx.fns.session.save({ agent });
    const { idx } = await ctx.fns.session.appendEvent({ id: agent.id, event: { type: 'tool_call', ...event } });
    return { agent, idx };
}

describe('GET /agent/:id/tool/:idx', () => {
    test('lazily renders arguments and result from raw event data', async () => {
        const ctx: any = await mkTestCtx();
        const { agent, idx } = await seed(ctx, { name: 'eval', args: { code: '1 + 1' }, result: '2', isError: false });
        const res = await ctx.fns.procs.http.dispatch({ url: `/agent/${agent.id}/tool/${idx}` });
        const html = await res.text();
        expect(res.status).toBe(200);
        expect(html).toContain('1 + 1');
        expect(html).toContain('2');
        expect(html).toContain('tool-code');
        expect(html).toContain('tool-result');
    });

    test('renders edit arguments as a diff on demand', async () => {
        const ctx: any = await mkTestCtx();
        const { agent, idx } = await seed(ctx, {
            name: 'edit',
            args: { path: 'a.ts', edits: [{ oldText: 'const a = 1;', newText: 'const a = 2;' }] },
            result: 'edited a.ts', isError: false,
        });
        const html = await (await ctx.fns.procs.http.dispatch({ url: `/agent/${agent.id}/tool/${idx}` })).text();
        expect(html).toContain('edit-preview');
        expect(html).toContain('const a = 1;');
        expect(html).toContain('const a = 2;');
    });

    test('does not return the next event for a missing idx', async () => {
        const ctx: any = await mkTestCtx();
        const { agent, idx } = await seed(ctx, { name: 'read', args: { path: 'a.ts' }, result: 'x', isError: false });
        const html = await (await ctx.fns.procs.http.dispatch({ url: `/agent/${agent.id}/tool/${idx - 1}` })).text();
        expect(html).toContain('(no body)');
        expect(html).not.toContain('a.ts');
    });

    test('rejects a non-numeric idx', async () => {
        const ctx: any = await mkTestCtx();
        const res = await ctx.fns.procs.http.dispatch({ url: '/agent/a/tool/nope' });
        expect(res.status).toBe(400);
    });
});
