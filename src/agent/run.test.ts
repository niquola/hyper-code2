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

    test('misplaced marker (no \\n before ///) is executed AND warned about', async () => {
        const ctx = await setup();
        let turn = 0;
        ctx.fns.llm.stream = async () => {
            turn++;
            if (turn === 1) {
                // Live-bug pattern: prose glued to marker without \n.
                return { text: 'считаю.///eval\nconsole.log(2 + 2);', toolCalls: [], thinking: '', usage: {} };
            }
            return { text: 'computed: 4', toolCalls: [], thinking: '', usage: {} };
        };
        ctx.fns.repl.eval = async (_c: any, code: string) => code.includes('console.log(2 + 2)') ? '4' : '';

        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        ctx.fns.session.save(ctx, a);

        await run(ctx, a, 'compute');

        const msgs = ctx.fns.session.getMessages(ctx, a.id);
        // The eval is executed (result gets fed back) AND a warning user-message
        // is appended after it. Then the model produces its closing prose.
        const result = msgs.find((m: any) => String(m.content ?? '').startsWith('///result:eval'));
        expect(result).toBeDefined();
        expect(result.content).toContain('4');
        const warn = msgs.find((m: any) => String(m.content ?? '').includes('///error:marker-misplaced'));
        expect(warn).toBeDefined();
        expect(warn.content).toContain('Warning');
        expect(warn.content).toContain('executed anyway');
        // Closing prose lands as the last assistant message.
        const lastAssistant = [...msgs].reverse().find((m: any) => m.role === 'assistant');
        expect(lastAssistant.content).toBe('computed: 4');
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

    test('parser-warning feedback user-message is flagged excluded_from_cursor', async () => {
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
            'SELECT idx, role, content, excluded_from_cursor FROM messages WHERE agent_id = ? AND role = ? ORDER BY idx',
            [a.id, 'user']);
        // Real input: idx 0, excluded=0. Tool result + warning are synthetic.
        expect(rows[0].excluded_from_cursor).toBe(0);
        const warn = rows.find((r: any) => String(r.content ?? '').includes('///error:marker-misplaced'));
        expect(warn).toBeDefined();
        expect(warn.excluded_from_cursor).toBe(1);
    });

    test('///html marker renders an assistant bubble with raw HTML and no synthetic result', async () => {
        const ctx = await setup();
        let turn = 0;
        ctx.fns.llm.stream = async () => {
            turn++;
            if (turn === 1) return { text: '///html\n<div class="card">Hi</div>', toolCalls: [], thinking: '', usage: {} };
            return { text: 'done', toolCalls: [], thinking: '', usage: {} };
        };

        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        ctx.fns.session.save(ctx, a);

        await run(ctx, a, 'render a card');

        const msgs = ctx.fns.session.getMessages(ctx, a.id);
        // Chain: user → assistant(///html) → assistant(done)
        // No synthetic ///result:html — html doesn't produce results.
        expect(msgs.map((m: any) => m.role)).toEqual(['user', 'assistant', 'assistant']);
        expect(msgs[1]!.content).toBe('///html\n<div class="card">Hi</div>');
        expect(msgs[1]!.content).not.toContain('///result');
        expect(msgs[2]!.content).toBe('done');

        // The UI event for the html marker carries the raw HTML, not the marker text.
        const events = ctx.fns.session.getEvents(ctx, a.id);
        const htmlEvent = events.find((e: any) => e.html === '<div class="card">Hi</div>');
        expect(htmlEvent).toBeDefined();
        expect(htmlEvent.type).toBe('assistant');
    });

    test('///html body with TSX {expr} renders interpolated values from agent.scratchpad', async () => {
        const ctx = await setup();
        let turn = 0;
        ctx.fns.llm.stream = async () => {
            turn++;
            if (turn === 1) {
                return {
                    text: '///html\n<div class="card"><h3>{agent.scratchpad.user.name}</h3><ul>{[1,2,3].map(n => <li>item {n}</li>)}</ul></div>',
                    toolCalls: [], thinking: '', usage: {},
                };
            }
            return { text: 'done', toolCalls: [], thinking: '', usage: {} };
        };

        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        a.scratchpad.user = { name: 'Иван' };
        ctx.fns.session.save(ctx, a);

        await run(ctx, a, 'render');

        const events = ctx.fns.session.getEvents(ctx, a.id);
        const htmlEvent = events.find((e: any) => e.type === 'assistant' && e.html?.includes('Иван'));
        expect(htmlEvent).toBeDefined();
        expect(htmlEvent.html).toBe('<div class="card"><h3>Иван</h3><ul><li>item 1</li><li>item 2</li><li>item 3</li></ul></div>');
    });

    test('///html TSX auto-escapes interpolated text (no XSS via scratchpad)', async () => {
        const ctx = await setup();
        let turn = 0;
        ctx.fns.llm.stream = async () => {
            turn++;
            if (turn === 1) return { text: '///html\n<div>{agent.scratchpad.danger}</div>', toolCalls: [], thinking: '', usage: {} };
            return { text: 'done', toolCalls: [], thinking: '', usage: {} };
        };
        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        a.scratchpad.danger = '<script>alert(1)</script>';
        ctx.fns.session.save(ctx, a);

        await run(ctx, a, 'render');

        const events = ctx.fns.session.getEvents(ctx, a.id);
        const htmlEvent = events.find((e: any) => e.type === 'assistant' && typeof e.html === 'string' && e.html.startsWith('<div>'));
        expect(htmlEvent).toBeDefined();
        // Auto-escaped — no live <script> tag, the angle brackets are entities.
        expect(htmlEvent.html).not.toContain('<script>');
        expect(htmlEvent.html).toContain('&lt;script&gt;');
    });

    test('///html TSX parse error is fed back as ///error:html user message', async () => {
        const ctx = await setup();
        let turn = 0;
        ctx.fns.llm.stream = async () => {
            turn++;
            // Unmatched closing tag — invalid TSX.
            if (turn === 1) return { text: '///html\n<div><span>oops</div>', toolCalls: [], thinking: '', usage: {} };
            return { text: 'fixed', toolCalls: [], thinking: '', usage: {} };
        };
        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        ctx.fns.session.save(ctx, a);

        await run(ctx, a, 'render broken');

        const msgs = ctx.fns.session.getMessages(ctx, a.id);
        // user(input) → assistant(///html bad) → user(///error:html) → assistant(fixed)
        const errMsg = msgs.find((m: any) => String(m.content ?? '').startsWith('///error:html'));
        expect(errMsg).toBeDefined();
        expect(errMsg.role).toBe('user');
    });

    test('///html body that is a full HTML document fails TSX parse and feeds error back', async () => {
        // Full <!DOCTYPE>/<html>/<body> markup is not a valid single TSX
        // expression — the parser rejects it. We expect an error-feedback
        // user-message (the agent can re-emit a clean fragment), and no
        // assistant html event at all.
        const ctx = await setup();
        const dirty = [
            '<!DOCTYPE html>',
            '<html><head>',
            '<title>oops</title>',
            '<style>body { margin: 40px }</style>',
            '</head><body>',
            '<div>x</div>',
            '</body></html>',
        ].join('\n');
        let turn = 0;
        ctx.fns.llm.stream = async () => {
            turn++;
            if (turn === 1) return { text: `///html\n${dirty}`, toolCalls: [], thinking: '', usage: {} };
            return { text: 'fixed', toolCalls: [], thinking: '', usage: {} };
        };
        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        ctx.fns.session.save(ctx, a);

        await run(ctx, a, 'render bad');

        const msgs = ctx.fns.session.getMessages(ctx, a.id);
        const errMsg = msgs.find((m: any) => String(m.content ?? '').startsWith('///error:html'));
        expect(errMsg).toBeDefined();
        expect(errMsg.role).toBe('user');
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
