import { describe, test, expect } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe('session.archive', () => {
    test('archived session disappears from list and cannot be loaded', async () => {
        const ctx: any = await mkTestCtx();
        ctx.fns.agent.renderEventHtml = async (_c: any, _s: any, _o: any) => '';
        const agent = ctx.fns.agent.start({ model: 'test:model', systemPrompt: '' });
        ctx.fns.session.save({ agent });
        await ctx.fns.session.appendUserMessage({ id: agent.id, text: 'hello archive' });
        expect(ctx.fns.session.list().some((a: any) => a.id === agent.id)).toBe(true);
        expect(ctx.fns.session.archive({ id: agent.id }).ok).toBe(true);
        expect(ctx.fns.session.list().some((a: any) => a.id === agent.id)).toBe(false);
        expect(ctx.fns.session.load({ id: agent.id })).toBeNull();
    });
});
