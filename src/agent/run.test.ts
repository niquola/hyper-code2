import { describe, test, expect } from 'bun:test';
import { mkTestCtx } from '../_testCtx.entry';
import run from './run';
import parseMarkers from './parseMarkers';
import formatMarkerResult from './formatMarkerResult';
import formatMarkerError from './formatMarkerError';

async function setup() {
    const ctx = await mkTestCtx();
    ctx.fns.agent.parseMarkers = parseMarkers;
    ctx.fns.agent.formatMarkerResult = formatMarkerResult;
    ctx.fns.agent.formatMarkerError = formatMarkerError;
    // Real eval — uses ctx.fns.repl.eval which mkTestCtx wires to a default fn.
    // Override per-test for richer behaviours.
    ctx.fns.files = ctx.fns.files ?? {};
    ctx.fns.files.write = async (_c: any, path: string, content: string) => {
        ((_c.state as any).__written ??= {})[path] = content;
        return { ok: true };
    };
    return ctx;
}

describe('agent.run', () => {
    test('plain reply (no markers) closes the turn', async () => {
        const ctx = await setup();
        ctx.fns.llm.stream = async () => ({ text: 'just a chat reply', toolCalls: [], thinking: '', usage: {} });

        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        ctx.fns.session.save(ctx, a);

        const res: any = await run(ctx, a, 'hi');
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

        await run(ctx, a, 'add 2 and 2');

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

        await run(ctx, a, 'create file');

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

        await run(ctx, a, 'write tricky');
        expect(ctx.state.__written['tricky.ts']).toBe(tricky);
    });

    test('multiple markers split into chained assistant→user pairs', async () => {
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

        await run(ctx, a, 'two things');

        const msgs = ctx.fns.session.getMessages(ctx, a.id);
        // Chain: user(input) → assistant(prose) → assistant(///eval) →
        //        user(///result:eval) → assistant(///write) → user(///result:write) → assistant(done)
        expect(msgs.map((m: any) => m.role))
            .toEqual(['user', 'assistant', 'assistant', 'user', 'assistant', 'user', 'assistant']);
        expect(msgs[1]!.content).toBe('doing two things');
        expect(msgs[2]!.content).toBe('///eval\nconsole.log(1);');
        expect(msgs[3]!.content).toContain('///result:eval');
        expect(msgs[3]!.content).toContain('1');
        expect(msgs[3]!.content).not.toContain('///result:write'); // result is per-call, not joined
        expect(msgs[4]!.content).toBe('///write:a.ts\nexport const a = 1;');
        expect(msgs[5]!.content).toContain('///result:write:a.ts');
        expect(msgs[6]!.content).toBe('done');
        expect(ctx.state.__written['a.ts']).toBe('export const a = 1;');
    });

    test('misplaced marker (no \\n before ///) is fed back as error and retried', async () => {
        const ctx = await setup();
        let turn = 0;
        ctx.fns.llm.stream = async () => {
            turn++;
            if (turn === 1) {
                // Live-bug pattern: prose glued to marker without \n.
                return { text: 'считаю.///eval\nconsole.log(2 + 2);', toolCalls: [], thinking: '', usage: {} };
            }
            if (turn === 2) {
                // Self-correct on second try.
                return { text: '///eval\nconsole.log(2 + 2);', toolCalls: [], thinking: '', usage: {} };
            }
            return { text: 'computed: 4', toolCalls: [], thinking: '', usage: {} };
        };
        ctx.fns.repl.eval = async (_c: any, code: string) => code.includes('console.log(2 + 2)') ? '4' : '';

        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        ctx.fns.session.save(ctx, a);

        await run(ctx, a, 'compute');

        const msgs = ctx.fns.session.getMessages(ctx, a.id);
        // user → assistant(misplaced) → user(error feedback) → assistant(///eval) → user(result) → assistant(prose)
        expect(msgs.map((m: any) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant', 'user', 'assistant']);
        // The first feedback message is just an error block (no result blocks since calls=[]).
        expect(msgs[2]!.content).toContain('///error:marker-misplaced');
        expect(msgs[2]!.content).toContain("'///eval'");
        expect(msgs[2]!.content).not.toContain('///result:');
        // After self-correction, normal result feedback.
        expect(msgs[4]!.content).toContain('///result:eval');
        expect(msgs[4]!.content).toContain('4');
    });

    test('synthetic ///result user-message is flagged excluded_from_cursor', async () => {
        const ctx = await setup();
        let turn = 0;
        ctx.fns.llm.stream = async () => {
            turn++;
            if (turn === 1) return { text: '///eval\nconsole.log(1);', toolCalls: [], thinking: '', usage: {} };
            return { text: 'done', toolCalls: [], thinking: '', usage: {} };
        };
        ctx.fns.repl.eval = async () => '1';

        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        ctx.fns.session.save(ctx, a);

        await run(ctx, a, 'go');

        const rows = ctx.fns.db.select(ctx,
            'SELECT idx, role, excluded_from_cursor, substr(content, 1, 30) as preview FROM messages WHERE agent_id = ? ORDER BY idx',
            [a.id]);
        // user(real) → assistant(///eval) → user(synthetic ///result) → assistant(done)
        expect(rows).toEqual([
            { idx: 0, role: 'user',      excluded_from_cursor: 0, preview: 'go' },
            { idx: 1, role: 'assistant', excluded_from_cursor: 0, preview: '///eval\nconsole.log(1);' },
            { idx: 2, role: 'user',      excluded_from_cursor: 1, preview: '///result:eval\n1' },
            { idx: 3, role: 'assistant', excluded_from_cursor: 0, preview: 'done' },
        ]);
    });

    test('parser-error feedback user-message is also flagged excluded_from_cursor', async () => {
        const ctx = await setup();
        let turn = 0;
        ctx.fns.llm.stream = async () => {
            turn++;
            if (turn === 1) return { text: 'считаю.///eval\nconsole.log(1);', toolCalls: [], thinking: '', usage: {} };
            return { text: 'fixed', toolCalls: [], thinking: '', usage: {} };
        };
        ctx.fns.repl.eval = async () => '1';

        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        ctx.fns.session.save(ctx, a);

        await run(ctx, a, 'compute');

        const rows = ctx.fns.db.select(ctx,
            'SELECT idx, role, excluded_from_cursor FROM messages WHERE agent_id = ? AND role = ? ORDER BY idx',
            [a.id, 'user']);
        // Expected: idx 0 = real input (excluded=0), idx 2 = error feedback (excluded=1).
        expect(rows[0]).toEqual({ idx: 0, role: 'user', excluded_from_cursor: 0 });
        const errFeedback = rows.find((r: any) => r.idx === 2);
        expect(errFeedback?.excluded_from_cursor).toBe(1);
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

        await run(ctx, a, 'fail');
        const msgs = ctx.fns.session.getMessages(ctx, a.id);
        expect(msgs[2]!.content).toContain('///result:eval:error');
        expect(msgs[2]!.content).toContain('boom');
    });
});
