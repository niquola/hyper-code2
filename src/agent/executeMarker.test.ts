import { describe, test, expect } from 'bun:test';
import { mkTestCtx } from '../_testCtx.entry';
import executeMarker from './executeMarker';
import serializeMarkerCall from './serializeMarkerCall';
import sanitizeHtmlBody from './sanitizeHtmlBody';
import executeBash from './executeBash';
import highlightResult from './highlightResult';
import formatMarkerResult from './formatMarkerResult';
import parseReadMarker from './parseReadMarker';

async function setup() {
    const ctx: any = await mkTestCtx();
    ctx.fns.agent.serializeMarkerCall = serializeMarkerCall;
    ctx.fns.agent.sanitizeHtmlBody = sanitizeHtmlBody;
    ctx.fns.agent.executeBash = executeBash;
    ctx.fns.agent.highlightResult = highlightResult;
    ctx.fns.agent.formatMarkerResult = formatMarkerResult;
    ctx.fns.agent.parseReadMarker = parseReadMarker;
    ctx.fns.files = ctx.fns.files ?? {};
    ctx.fns.files.write = async (c: any, opts: { path: string; content: string }) => {
        ((c.state as any).__written ??= {})[opts.path] = opts.content;
        return { ok: true };
    };
    ctx.fns.files.read = async (_c: any, opts: { path: string }) =>
        opts.path === 'src/x.ts' ? ['a', 'b', 'c', 'd', 'e'].join('\n') : `READ:${opts.path}`;
    ctx.fns.files.readHashline = async (_c: any, opts: any) => ({ text: `READHASH:${opts.path}:${opts.startLine ?? ''}:${opts.endLine ?? ''}:${opts.maxLines ?? ''}` });
    ctx.fns.files.grep = async () => [{ path: "a.ts", line: 2, column: 3, text: "foo" }];
    ctx.fns.files.grepHashline = async () => [{ path: "a.ts", line: 2, column: 3, text: "foo", anchor: "2aa" }];
    ctx.fns.files.editHashline = async (_c: any, opts: { input: string }) => {
        const path = opts.input.split('\n')[0]!.slice(1);
        return { path, bytes: 12, diff: "", content: "ok" };
    };
    ctx.fns.repl.eval = async (_c: any, opts: { code: string }) =>
        opts.code.includes('throw') ? (() => { throw new Error('boom'); })() : `eval-result-of:${opts.code}`;
    return ctx;
}

function mkAgent(ctx: any) {
    const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
    ctx.fns.session.save(ctx, { agent: a });
    return a;
}

describe('agent.executeMarker', () => {
    test('eval: persists §eval message + tool_call event + §result:eval feedback', async () => {
        const ctx = await setup();
        const a = mkAgent(ctx);

        await executeMarker(ctx, { agent: a, call: { kind: 'eval', content: '1 + 1' }, usage: {} });

        const msgs = ctx.fns.session.getMessages(ctx, { id: a.id });
        expect(msgs.map((m: any) => m.role)).toEqual(['assistant', 'user']);
        expect(msgs[0]!.content).toBe('§eval\n1 + 1');
        expect(msgs[1]!.content).toBe('§result:eval\neval-result-of:1 + 1');

        const events = ctx.fns.session.getEvents(ctx, { id: a.id });
        expect(events[0]!.name).toBe('eval');
        expect(events[0]!.isError).toBe(false);
    });

    test('read plain: emits §result:read:path', async () => {
        const ctx = await setup();
        const a = mkAgent(ctx);

        await executeMarker(ctx, { agent: a, call: { kind: 'read', path: 'src/x.ts', format: 'plain' }, usage: {} });

        const msgs = ctx.fns.session.getMessages(ctx, { id: a.id });
        expect(msgs[0]!.content).toBe('§read\nsrc/x.ts');
        expect(msgs[1]!.content).toBe('§result:read:src/x.ts\na\nb\nc\nd\ne');
    });

    test('read plain supports structured range body', async () => {
        const ctx = await setup();
        const a = mkAgent(ctx);

        await executeMarker(ctx, {
            agent: a,
            call: { kind: 'read', path: 'path: src/x.ts\nstartLine: 2\nendLine: 4', format: 'plain' },
            usage: {},
        });

        const msgs = ctx.fns.session.getMessages(ctx, { id: a.id });
        expect(msgs[1]!.content).toBe('§result:read:path: src/x.ts\nstartLine: 2\nendLine: 4\nb\nc\nd');
    });

    test('read hashline: emits §result:read:hashline:path', async () => {
        const ctx = await setup();
        const a = mkAgent(ctx);

        await executeMarker(ctx, { agent: a, call: { kind: 'read', path: 'src/x.ts', format: 'hashline' }, usage: {} });

        const msgs = ctx.fns.session.getMessages(ctx, { id: a.id });
        expect(msgs[0]!.content).toBe('§read:hashline\nsrc/x.ts');
        expect(msgs[1]!.content).toBe('§result:read:hashline:src/x.ts\nREADHASH:src/x.ts:::');
    });

    test('read hashline supports structured range body', async () => {
        const ctx = await setup();
        const a = mkAgent(ctx);

        await executeMarker(ctx, {
            agent: a,
            call: { kind: 'read', path: 'path: src/x.ts\nmaxLines: 2', format: 'hashline' },
            usage: {},
        });

        const msgs = ctx.fns.session.getMessages(ctx, { id: a.id });
        expect(msgs[1]!.content).toBe('§result:read:hashline:path: src/x.ts\nmaxLines: 2\nREADHASH:src/x.ts:::2');
    });

    test('grep plain: emits line-based rows', async () => {
        const ctx = await setup();
        const a = mkAgent(ctx);

        await executeMarker(ctx, { agent: a, call: { kind: 'grep', format: 'plain', content: 'pattern: foo' }, usage: {} });

        const msgs = ctx.fns.session.getMessages(ctx, { id: a.id });
        expect(msgs[0]!.content).toBe('§grep\npattern: foo');
        expect(msgs[1]!.content).toBe('§result:grep\na.ts:2:3|foo');
    });

    test('grep hashline: emits anchor-based rows', async () => {
        const ctx = await setup();
        const a = mkAgent(ctx);

        await executeMarker(ctx, { agent: a, call: { kind: 'grep', format: 'hashline', content: 'pattern: foo' }, usage: {} });

        const msgs = ctx.fns.session.getMessages(ctx, { id: a.id });
        expect(msgs[0]!.content).toBe('§grep:hashline\npattern: foo');
        expect(msgs[1]!.content).toBe('§result:grep:hashline\na.ts:2aa:3|foo');
    });

    test('edit hashline: emits edit result', async () => {
        const ctx = await setup();
        const a = mkAgent(ctx);

        await executeMarker(ctx, { agent: a, call: { kind: 'edit', format: 'hashline', content: '@a.ts\n= 1aa\n|x' }, usage: {} });

        const msgs = ctx.fns.session.getMessages(ctx, { id: a.id });
        expect(msgs[0]!.content).toBe('§edit:hashline\n@a.ts\n= 1aa\n|x');
        expect(msgs[1]!.content).toBe('§result:edit:hashline\nedited a.ts (12 bytes)');
    });

    test('edit hashline error bubbles through', async () => {
        const ctx = await setup();
        ctx.fns.files.editHashline = async () => { throw new Error("stale anchor"); };
        const a = mkAgent(ctx);

        await executeMarker(ctx, { agent: a, call: { kind: 'edit', format: 'hashline', content: '@a.ts\n= 1aa\n|x' }, usage: {} });

        const msgs = ctx.fns.session.getMessages(ctx, { id: a.id });
        expect(msgs[1]!.content).toBe('§result:edit:hashline:error\nError: stale anchor');
        const events = ctx.fns.session.getEvents(ctx, { id: a.id });
        expect(events[0]!.isError).toBe(true);
    });

    test('html: success persists assistant message + assistant event with the HTML body, NO §result feedback', async () => {
        const ctx = await setup();
        const a = mkAgent(ctx);

        await executeMarker(ctx, { agent: a, call: { kind: 'html', content: '<p class="x">hi</p>' }, usage: {} });

        const msgs = ctx.fns.session.getMessages(ctx, { id: a.id });
        expect(msgs.map((m: any) => m.role)).toEqual(['assistant']);
        expect(msgs[0]!.content).toBe('§html\n<p class="x">hi</p>');
    });
});