import { expect, test } from 'bun:test';
import { mkTestCtx } from '../_testCtx.entry';

test('agent.toolDetails lazily returns popup content', async () => {
    const ctx: any = await mkTestCtx();
    const agent = await ctx.fns.agent.start({ model: 'mock:test' });
    await ctx.fns.session.save({ agent });
    const { idx } = await ctx.fns.session.appendEvent({ id: agent.id, event: { type: 'tool_call', name: 'eval', args: { code: '1 + 1' }, result: '2' } });
    const res = await ctx.fns.agent.toolDetails({ agentId: agent.id, idx });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('data-popup-kind="tool"');
    expect(html).toContain('1 + 1');
    expect(html).toContain('2');
});
