import { describe, test, expect } from 'bun:test';
import { mkTestCtx } from '../_testCtx.entry';
import runMarkers from './runMarkers';
import parseMarkers from './parseMarkers';
import formatMarkerResult from './formatMarkerResult';

async function setup() {
    const ctx = await mkTestCtx();
    ctx.fns.agent.parseMarkers = parseMarkers;
    ctx.fns.agent.formatMarkerResult = formatMarkerResult;
    // Real eval — uses ctx.fns.repl.eval which mkTestCtx wires to a default fn.
    // Override per-test for richer behaviours.
    ctx.fns.files = ctx.fns.files ?? {};
    ctx.fns.files.write = async (_c: any, path: string, content: string) => {
        ((_c.state as any).__written ??= {})[path] = content;
        return { ok: true };
    };
    return ctx;
}

describe('agent.runMarkers', () => {
    test('plain reply (no markers) closes the turn', async () => {
        const ctx = await setup();
        ctx.fns.llm.stream = async () => ({ text: 'just a chat reply', toolCalls: [], thinking: '', usage: {} });

        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        ctx.fns.session.save(ctx, a);

        const res: any = await runMarkers(ctx, a, 'hi');
        expect(res.text).toBe('just a chat reply');

        const msgs = ctx.fns.session.getMessages(ctx, a.id);
        expect(msgs.map((m: any) => m.role)).toEqual(['user', 'assistant']);
        expect(msgs[1].content).toBe('just a chat reply');
    });

    test('single ///eval marker is executed and result fed back', async () => {
        const ctx = await setup();
        let turn = 0;
        ctx.fns.llm.stream = async () => {
            turn++;
            if (turn === 1) return { text: '///eval\nconsole.log(2 + 2);', toolCalls: [], thinking: '', usage: {} };
            return { text: 'computed: 4', toolCalls: [], thinking: '', usage: {} };
        };
        // repl.eval is Jupyter-style: returns the captured log buffer as a string.
        ctx.fns.repl.eval = async (_c: any, code: string) => code.includes('console.log(2 + 2)') ? '4' : '';

        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        ctx.fns.session.save(ctx, a);

        await runMarkers(ctx, a, 'add 2 and 2');

        const msgs = ctx.fns.session.getMessages(ctx, a.id);
        // user → assistant(///eval) → user(///result:eval) → assistant(prose)
        expect(msgs.map((m: any) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
        expect(msgs[1].content).toContain('///eval');
        expect(msgs[2].content).toContain('///result:eval');
        expect(msgs[2].content).toContain('4');
        expect(msgs[3].content).toBe('computed: 4');
    });

    test('///write marker invokes files.write with raw content', async () => {
        const ctx = await setup();
        let turn = 0;
        const body = 'export default function () {\n  return `hi ${who}`;\n}\n';
        ctx.fns.llm.stream = async () => {
            turn++;
            if (turn === 1) return { text: `///write:src/foo.ts\n${body}`, toolCalls: [], thinking: '', usage: {} };
            return { text: 'done', toolCalls: [], thinking: '', usage: {} };
        };

        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        ctx.fns.session.save(ctx, a);

        await runMarkers(ctx, a, 'create file');

        // files.write should have been called with the EXACT content, no escape munging.
        expect(ctx.state.__written['src/foo.ts']).toBe(body.replace(/\n$/, ''));
    });

    test('content with backticks/template-literals survives roundtrip unchanged', async () => {
        const ctx = await setup();
        const tricky = 'const x = `hello ${name}`;\nconst y = "with \\\"quotes\\\"";';
        let turn = 0;
        ctx.fns.llm.stream = async () => {
            turn++;
            if (turn === 1) return { text: `///write:tricky.ts\n${tricky}`, toolCalls: [], thinking: '', usage: {} };
            return { text: 'ok', toolCalls: [], thinking: '', usage: {} };
        };

        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        ctx.fns.session.save(ctx, a);

        await runMarkers(ctx, a, 'write tricky');
        expect(ctx.state.__written['tricky.ts']).toBe(tricky);
    });

    test('multiple markers in one turn execute sequentially, results joined', async () => {
        const ctx = await setup();
        let turn = 0;
        ctx.fns.llm.stream = async () => {
            turn++;
            if (turn === 1) return {
                text: 'doing two things\n///eval\nconsole.log(1);\n///write:a.ts\nexport const a = 1;',
                toolCalls: [], thinking: '', usage: {},
            };
            return { text: 'done', toolCalls: [], thinking: '', usage: {} };
        };
        ctx.fns.repl.eval = async () => '1';

        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        ctx.fns.session.save(ctx, a);

        await runMarkers(ctx, a, 'two things');

        const msgs = ctx.fns.session.getMessages(ctx, a.id);
        // Single user message contains BOTH result blocks.
        const resultMsg = msgs[2]!.content;
        expect(resultMsg).toContain('///result:eval');
        expect(resultMsg).toContain('///result:write:a.ts');
        expect(ctx.state.__written['a.ts']).toBe('export const a = 1;');
    });

    test('eval errors are tagged :error in the result block', async () => {
        const ctx = await setup();
        let turn = 0;
        ctx.fns.llm.stream = async () => {
            turn++;
            if (turn === 1) return { text: '///eval\nthrow new Error("boom");', toolCalls: [], thinking: '', usage: {} };
            return { text: 'caught', toolCalls: [], thinking: '', usage: {} };
        };
        ctx.fns.repl.eval = async () => { throw new Error('boom'); };

        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        ctx.fns.session.save(ctx, a);

        await runMarkers(ctx, a, 'fail');
        const msgs = ctx.fns.session.getMessages(ctx, a.id);
        expect(msgs[2]!.content).toContain('///result:eval:error');
        expect(msgs[2]!.content).toContain('boom');
    });
});
