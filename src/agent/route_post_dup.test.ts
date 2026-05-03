import { describe, test, expect } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";
import routePost from "./$route_$id_POST";

describe('agent POST route', () => {
    test('does not duplicate user message even if called twice', async () => {
        const ctx = await mkTestCtx();
        const agent = ctx.fns.agent.start(ctx, { model: 'mock:test', systemPrompt: '' });
        ctx.fns.session.save(ctx, { agent });
        (ctx.state as any).agent = { [agent.id]: agent };

        const req = new Request('http://x/agent/' + agent.id + '?debounceSeconds=0', { method: 'POST', body: 'hello once' });
        (req as any).params = { id: agent.id };

        const res = await routePost(ctx, null, req);
        expect(res.status).toBe(200);

        const userMsgs = ctx.fns.session.getMessages(ctx, { id: agent.id })
            .filter((m: any) => m.role === 'user' && m.content === 'hello once');
        expect(userMsgs.length).toBe(1);
    });
});
