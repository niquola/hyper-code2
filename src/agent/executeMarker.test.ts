import { describe, test, expect } from 'bun:test';
import { mkTestCtx } from '../_testCtx.entry';
import executeMarker from './executeMarker';
import serializeMarkerCall from './serializeMarkerCall';
import sanitizeHtmlBody from './sanitizeHtmlBody';
import executeBash from './executeBash';
import highlightResult from './highlightResult';
import formatMarkerResult from './formatMarkerResult';

async function setup() {
    const ctx: any = await mkTestCtx();
    // Wire the helpers executeMarker depends on.
    ctx.fns.agent.serializeMarkerCall = serializeMarkerCall;
    ctx.fns.agent.sanitizeHtmlBody = sanitizeHtmlBody;
    ctx.fns.agent.executeBash = executeBash;
    ctx.fns.agent.highlightResult = highlightResult;
    ctx.fns.agent.formatMarkerResult = formatMarkerResult;
    // files.write — record into ctx.state.__written for assertions.
    ctx.fns.files = ctx.fns.files ?? {};
    ctx.fns.files.write = async (c: any, path: string, content: string) => {
        ((c.state as any).__written ??= {})[path] = content;
        return { ok: true };
    };
    // repl.eval — return a deterministic value per code.
    ctx.fns.repl.eval = async (_c: any, code: string) =>
        code.includes('throw') ? (() => { throw new Error('boom'); })() : `eval-result-of:${code}`;
    return ctx;
}

function mkAgent(ctx: any) {
    const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
    ctx.fns.session.save(ctx, a);
    return a;
}

describe('agent.executeMarker', () => {
    test('eval: persists §eval message + tool_call event + §result:eval feedback', async () => {
        const ctx = await setup();
        const a = mkAgent(ctx);

        await executeMarker(ctx, a, { kind: 'eval', content: '1 + 1' }, { usage: {} });

        const msgs = ctx.fns.session.getMessages(ctx, a.id);
        expect(msgs.map((m: any) => m.role)).toEqual(['assistant', 'user']);
        expect(msgs[0]!.content).toBe('§eval\n1 + 1');
        expect(msgs[1]!.content).toBe('§result:eval\neval-result-of:1 + 1');

        const events = ctx.fns.session.getEvents(ctx, a.id);
        expect(events.map((e: any) => e.type)).toEqual(['tool_call']);
        expect(events[0]!.name).toBe('eval');
        expect(events[0]!.isError).toBe(false);
    });

    test('eval: thrown error becomes §result:eval:error', async () => {
        const ctx = await setup();
        const a = mkAgent(ctx);

        await executeMarker(ctx, a, { kind: 'eval', content: 'throw boom' }, { usage: {} });

        const msgs = ctx.fns.session.getMessages(ctx, a.id);
        expect(msgs[1]!.content).toContain('§result:eval:error');
        expect(msgs[1]!.content).toContain('boom');

        const events = ctx.fns.session.getEvents(ctx, a.id);
        expect(events[0]!.isError).toBe(true);
    });

    test('write: invokes files.write with raw content + emits "wrote N bytes" feedback', async () => {
        const ctx = await setup();
        const a = mkAgent(ctx);
        const body = 'export default 1;\n';

        await executeMarker(ctx, a, { kind: 'write', path: 'src/x.ts', content: body }, { usage: {} });

        expect(ctx.state.__written['src/x.ts']).toBe(body);

        const msgs = ctx.fns.session.getMessages(ctx, a.id);
        expect(msgs[0]!.content).toBe(`§write:src/x.ts\n${body}`);
        expect(msgs[1]!.content).toContain('§result:write:src/x.ts');
        expect(msgs[1]!.content).toContain(`wrote src/x.ts (${body.length} bytes`);
    });

    test('bash: success returns stdout in §result:bash', async () => {
        const ctx = await setup();
        const a = mkAgent(ctx);

        await executeMarker(ctx, a, { kind: 'bash', content: 'echo hello' }, { usage: {} });

        const msgs = ctx.fns.session.getMessages(ctx, a.id);
        expect(msgs[0]!.content).toBe('§bash\necho hello');
        expect(msgs[1]!.content).toBe('§result:bash\nhello');

        const events = ctx.fns.session.getEvents(ctx, a.id);
        expect(events[0]!.isError).toBe(false);
    });

    test('bash: non-zero exit marks isError + §result:bash:error', async () => {
        const ctx = await setup();
        const a = mkAgent(ctx);

        await executeMarker(ctx, a, { kind: 'bash', content: 'exit 3' }, { usage: {} });

        const msgs = ctx.fns.session.getMessages(ctx, a.id);
        expect(msgs[1]!.content).toContain('§result:bash:error');
        expect(msgs[1]!.content).toContain('[exit 3]');
        const events = ctx.fns.session.getEvents(ctx, a.id);
        expect(events[0]!.isError).toBe(true);
    });

    test('html: success persists assistant message + assistant event with the HTML body, NO §result feedback', async () => {
        const ctx = await setup();
        const a = mkAgent(ctx);

        await executeMarker(ctx, a, { kind: 'html', content: '<p class="x">hi</p>' }, { usage: {} });

        const msgs = ctx.fns.session.getMessages(ctx, a.id);
        // Only the assistant marker message — no synthetic §result.
        expect(msgs.map((m: any) => m.role)).toEqual(['assistant']);
        expect(msgs[0]!.content).toBe('§html\n<p class="x">hi</p>');

        const events = ctx.fns.session.getEvents(ctx, a.id);
        expect(events[0]!.type).toBe('assistant');
        expect(events[0]!.html).toBe('<p class="x">hi</p>');
    });

    test('html: body is sanitised — DOCTYPE, <html>, <body>, <style>, <script> stripped', async () => {
        const ctx = await setup();
        const a = mkAgent(ctx);

        const body = '<!DOCTYPE html><html><body><style>x{}</style><script>alert(1)</script><p class="x">ok</p></body></html>';
        await executeMarker(ctx, a, { kind: 'html', content: body }, { usage: {} });

        const events = ctx.fns.session.getEvents(ctx, a.id);
        expect(events[0]!.html).toBe('<p class="x">ok</p>');
    });

    test('html: braces and {expr} are kept verbatim — no template engine', async () => {
        const ctx = await setup();
        const a = mkAgent(ctx);

        // Plain HTML mode — anything that looks like a template var stays
        // as literal text in the bubble.
        const body = '<p>hello {agent.id} — {1 + 1}</p>';
        await executeMarker(ctx, a, { kind: 'html', content: body }, { usage: {} });

        const events = ctx.fns.session.getEvents(ctx, a.id);
        expect(events[0]!.html).toBe('<p>hello {agent.id} — {1 + 1}</p>');
    });

    test('synthetic §result:* feedback is excluded_from_cursor=1', async () => {
        const ctx = await setup();
        const a = mkAgent(ctx);

        await executeMarker(ctx, a, { kind: 'eval', content: '1' }, { usage: {} });

        // Drop into raw DB to see the column directly.
        const rows = ctx.fns.db.select(ctx, 'SELECT role, excluded_from_cursor FROM messages WHERE agent_id = ? ORDER BY idx', [a.id]);
        const userRow = rows.find((r: any) => r.role === 'user');
        expect(userRow.excluded_from_cursor).toBe(1);
        const assistantRow = rows.find((r: any) => r.role === 'assistant');
        expect(assistantRow.excluded_from_cursor).toBe(0);
    });
});
