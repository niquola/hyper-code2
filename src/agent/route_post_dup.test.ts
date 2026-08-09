import { describe, test, expect } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe('agent POST route', () => {
    test('does not duplicate user message even if called twice', async () => {
        const ctx = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: 'mock:test', systemPrompt: '' });
        await ctx.fns.session.save({ agent });
        (ctx.state as any).agent = { [agent.id]: agent };

        const res = await ctx.fns.procs.http.dispatch({
            method: 'POST',
            url: '/agent/' + agent.id + '?debounceSeconds=0',
            body: 'hello once',
        });
        expect(res.status).toBe(200);

        const userMsgs = (await ctx.fns.session.getMessages({ id: agent.id }))
            .filter((m: any) => m.role === 'user' && m.content === 'hello once');
        expect(userMsgs.length).toBe(1);
    });
});
