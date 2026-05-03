import { test, expect, describe } from 'bun:test';
import route from './$route_$id_GET';
import layout from '../$layout';
import script from '../ui/script';
import renderEventHtml from './renderEventHtml';
import renderStatusBar from './renderStatusBar';

const mkCtx = (agents: Record<string, any> = {}) => ({
    state: { agent: agents },
    env: {},
    fns: {
        ui: { script },
        agent: { renderEventHtml, renderStatusBar },
        db: { select: () => [{ n: 0 }] },
        session: {
            syncAgentState: (_ctx: Context, agent: any) => agent,
            getFullMessages: (_ctx: Context, _id: string) => [],
            getMessages: (_ctx: Context, _id: string) => [],
            getEvents: (_ctx: Context, _id: string) => [],
            getMaxEventIdx: (_ctx: Context, _id: string) => -1,
            load: (_ctx: Context, _id: string) => null,
        },
    },
    layout,
} as unknown as Context);

function req(id: string): any {
    const r = new Request('http://x/agent/' + id);
    (r as any).params = { id };
    return r;
}

async function render(ctx: Context, id: string): Promise<string> {
    const out: any = await route(ctx, null, req(id));
    if (out instanceof Response) throw new Error('expected {main}, got Response ' + out.status);
    return layout(ctx, out);
}

describe('GET /agent/:id', () => {
    test('404 when agent does not exist', async () => {
        const res = await route(mkCtx(), null, req('nope'));
        expect(res instanceof Response).toBe(true);
        expect((res as Response).status).toBe(404);
    });

    test('loads agent from session storage when missing from runtime state', async () => {
        const loaded = { id: 'db', model: 'db-model', messages: [], events: [], isStreaming: false };
        const ctx = mkCtx();
        let requestedId = '';
        (ctx.fns as any).session.load = (_ctx: Context, opts: { id: string }) => {
            requestedId = opts.id;
            return opts.id === 'db' ? loaded : null;
        };

        const html = await render(ctx, 'db');
        expect(requestedId).toBe('db');
        expect((ctx.state as any).agent.db).toBe(loaded);
        expect(html).toContain('db');
        expect(html).toContain('db-model');
    });
});
