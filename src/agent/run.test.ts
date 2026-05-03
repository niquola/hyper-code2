import { describe, test, expect } from 'bun:test';
import { mkTestCtx } from '../_testCtx.entry';
import runFn from './run';
import parseMarkers from './parseMarkers';
import formatMarkerResult from './formatMarkerResult';
import formatMarkerError from './formatMarkerError';

const run = (ctx: any, agent: any, userText: string) => runFn(ctx, { agent, userText });

async function setup() {
    const ctx = await mkTestCtx();
    ctx.fns.agent.parseMarkers = parseMarkers;
    ctx.fns.agent.formatMarkerResult = formatMarkerResult;
    ctx.fns.agent.formatMarkerError = formatMarkerError;
    // Real eval — uses ctx.fns.repl.eval which mkTestCtx wires to a default fn.
    // Override per-test for richer behaviours.
    ctx.fns.files = ctx.fns.files ?? {};
    ctx.fns.files.write = async (_c: any, opts: { path: string; content: string }) => {
        ((_c.state as any).__written ??= {})[opts.path] = opts.content;
        return { ok: true };
    };
    return ctx;
}

describe('agent.run', () => {
    test('plain reply (no markers) closes the turn', async () => {
        const ctx = await setup();
        ctx.fns.llm.stream = async () => ({ text: 'just a chat reply', toolCalls: [], thinking: '', usage: {} });

        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        ctx.fns.session.save(ctx, { agent: a });

        const res: any = await run(ctx, a, 'hi');
        expect(res.text).toBe('just a chat reply');

        const msgs = ctx.fns.session.getMessages(ctx, { id: a.id });
        expect(msgs.map((m: any) => m.role)).toEqual(['user', 'assistant']);
        expect(msgs[1].content).toBe('just a chat reply');
    });

    test('single §eval marker is executed and result fed back', async () => {
        const ctx = await setup();
        let turn = 0;
        ctx.fns.llm.stream = async () => {
            turn++;
            if (turn === 1) return { text: '§eval\nconsole.log(2 + 2);', toolCalls: [], thinking: '', usage: {} };
            return { text: 'computed: 4', toolCalls: [], thinking: '', usage: {} };
        };
        // repl.eval is Jupyter-style: returns the captured log buffer as a string.
        ctx.fns.repl.eval = async (_c: any, opts: { code: string }) => opts.code.includes('console.log(2 + 2)') ? '4' : '';

        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        ctx.fns.session.save(ctx, { agent: a });

        await run(ctx, a, 'add 2 and 2');

        const msgs = ctx.fns.session.getMessages(ctx, { id: a.id });
        // user → assistant(§eval) → user(§result:eval) → assistant(prose)
        expect(msgs.map((m: any) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
        expect(msgs[1].content).toContain('§eval');
        expect(msgs[2].content).toContain('§result:eval');
        expect(msgs[2].content).toContain('4');
        expect(msgs[3].content).toBe('computed: 4');
    });

    test('§write marker invokes files.write with raw content', async () => {
        const ctx = await setup();
        let turn = 0;
        const body = 'export default function () {\n  return `hi ${who}`;\n}\n';
        ctx.fns.llm.stream = async () => {
            turn++;
            if (turn === 1) return { text: `§write:src/foo.ts\n${body}`, toolCalls: [], thinking: '', usage: {} };
            return { text: 'done', toolCalls: [], thinking: '', usage: {} };
        };

        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        ctx.fns.session.save(ctx, { agent: a });

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
            if (turn === 1) return { text: `§write:tricky.ts\n${tricky}`, toolCalls: [], thinking: '', usage: {} };
            return { text: 'ok', toolCalls: [], thinking: '', usage: {} };
        };

        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        ctx.fns.session.save(ctx, { agent: a });

        await run(ctx, a, 'write tricky');
        expect(ctx.state.__written['tricky.ts']).toBe(tricky);
    });

    test('multiple markers split into chained assistant→user pairs', async () => {
        const ctx = await setup();
        let turn = 0;
        ctx.fns.llm.stream = async () => {
            turn++;
            if (turn === 1) return {
                text: 'doing two things\n§eval\nconsole.log(1);\n§write:a.ts\nexport const a = 1;',
                toolCalls: [], thinking: '', usage: {},
            };
            return { text: 'done', toolCalls: [], thinking: '', usage: {} };
        };
        ctx.fns.repl.eval = async () => '1';

        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        ctx.fns.session.save(ctx, { agent: a });

        await run(ctx, a, 'two things');

        const msgs = ctx.fns.session.getMessages(ctx, { id: a.id });
        // Chain: user(input) → assistant(prose) → assistant(§eval) →
        //        user(§result:eval) → assistant(§write) → user(§result:write) → assistant(done)
        expect(msgs.map((m: any) => m.role))
            .toEqual(['user', 'assistant', 'assistant', 'user', 'assistant', 'user', 'assistant']);
        expect(msgs[1]!.content).toBe('doing two things');
        expect(msgs[2]!.content).toBe('§eval\nconsole.log(1);');
        expect(msgs[3]!.content).toContain('§result:eval');
        expect(msgs[3]!.content).toContain('1');
        expect(msgs[3]!.content).not.toContain('§result:write'); // result is per-call, not joined
        expect(msgs[4]!.content).toBe('§write:a.ts\nexport const a = 1;');
        expect(msgs[5]!.content).toContain('§result:write:a.ts');
        expect(msgs[6]!.content).toBe('done');
        expect(ctx.state.__written['a.ts']).toBe('export const a = 1;');
    });

    test('misplaced marker (no \\n before §) is NOT executed; warning fed back to model', async () => {
        const ctx = await setup();
        let turn = 0;
        ctx.fns.llm.stream = async () => {
            turn++;
            if (turn === 1) {
                // Bug pattern: model glues prose to marker without \n.
                return { text: 'считаю.§eval\nconsole.log(2 + 2);', toolCalls: [], thinking: '', usage: {} };
            }
            // After seeing the warning, model retries with proper format.
            if (turn === 2) {
                return { text: '§eval\nconsole.log(2 + 2);', toolCalls: [], thinking: '', usage: {} };
            }
            return { text: 'computed: 4', toolCalls: [], thinking: '', usage: {} };
        };
        let evalCalls = 0;
        ctx.fns.repl.eval = async (_c: any, opts: { code: string }) => {
            evalCalls++;
            return opts.code.includes('console.log(2 + 2)') ? '4' : '';
        };

        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        ctx.fns.session.save(ctx, { agent: a });

        await run(ctx, a, 'compute');

        const msgs = ctx.fns.session.getMessages(ctx, { id: a.id });
        // Strict: turn 1's misplaced §eval did NOT run. Only turn 2's clean
        // §eval ran. So exactly one §result:eval lands.
        const results = msgs.filter((m: any) => String(m.content ?? '').startsWith('§result:eval'));
        expect(results).toHaveLength(1);
        expect(evalCalls).toBe(1);
        // The warning was fed back: a user message containing §error:marker-unescaped.
        const warn = msgs.find((m: any) => String(m.content ?? '').includes('§error:marker-unescaped'));
        expect(warn).toBeDefined();
        expect(warn.content).toContain('Warning');
        expect(warn.content).toContain('reserved for marker execution');
        // Closing prose lands as the last assistant message.
        const lastAssistant = [...msgs].reverse().find((m: any) => m.role === 'assistant');
        expect(lastAssistant.content).toBe('computed: 4');
    });

    test('synthetic §result user-message is flagged excluded_from_cursor', async () => {
        const ctx = await setup();
        let turn = 0;
        ctx.fns.llm.stream = async () => {
            turn++;
            if (turn === 1) return { text: '§eval\nconsole.log(1);', toolCalls: [], thinking: '', usage: {} };
            return { text: 'done', toolCalls: [], thinking: '', usage: {} };
        };
        ctx.fns.repl.eval = async () => '1';

        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        ctx.fns.session.save(ctx, { agent: a });

        await run(ctx, a, 'go');

        const rows = ctx.fns.db.select(ctx, {
            sql: 'SELECT idx, role, excluded_from_cursor, substr(content, 1, 30) as preview FROM messages WHERE agent_id = ? ORDER BY idx',
            params: [a.id],
        });
        // user(real) → assistant(§eval) → user(synthetic §result) → assistant(done)
        expect(rows).toEqual([
            { idx: 0, role: 'user',      excluded_from_cursor: 0, preview: 'go' },
            { idx: 1, role: 'assistant', excluded_from_cursor: 0, preview: '§eval\nconsole.log(1);' },
            { idx: 2, role: 'user',      excluded_from_cursor: 1, preview: '§result:eval\n1' },
            { idx: 3, role: 'assistant', excluded_from_cursor: 0, preview: 'done' },
        ]);
    });

    test('parser-warning feedback user-message is flagged excluded_from_cursor', async () => {
        const ctx = await setup();
        let turn = 0;
        ctx.fns.llm.stream = async () => {
            turn++;
            if (turn === 1) return { text: 'считаю.§eval\nconsole.log(1);', toolCalls: [], thinking: '', usage: {} };
            return { text: 'fixed', toolCalls: [], thinking: '', usage: {} };
        };
        ctx.fns.repl.eval = async () => '1';

        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        ctx.fns.session.save(ctx, { agent: a });

        await run(ctx, a, 'compute');

        const rows = ctx.fns.db.select(ctx, {
            sql: 'SELECT idx, role, content, excluded_from_cursor FROM messages WHERE agent_id = ? AND role = ? ORDER BY idx',
            params: [a.id, 'user'],
        });
        // Real input: idx 0, excluded=0. Synthetic warning is excluded.
        expect(rows[0].excluded_from_cursor).toBe(0);
        const warn = rows.find((r: any) => String(r.content ?? '').includes('§error:marker-unescaped'));
        expect(warn).toBeDefined();
        expect(warn.excluded_from_cursor).toBe(1);
    });

    test('§html marker renders an assistant bubble with raw HTML and no synthetic result', async () => {
        const ctx = await setup();
        let turn = 0;
        ctx.fns.llm.stream = async () => {
            turn++;
            if (turn === 1) return { text: '§html\n<div class="card">Hi</div>', toolCalls: [], thinking: '', usage: {} };
            return { text: 'done', toolCalls: [], thinking: '', usage: {} };
        };

        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        ctx.fns.session.save(ctx, { agent: a });

        await run(ctx, a, 'render a card');

        const msgs = ctx.fns.session.getMessages(ctx, { id: a.id });
        // Chain: user → assistant(§html) → assistant(done)
        // No synthetic §result:html — html doesn't produce results.
        expect(msgs.map((m: any) => m.role)).toEqual(['user', 'assistant', 'assistant']);
        expect(msgs[1]!.content).toBe('§html\n<div class="card">Hi</div>');
        expect(msgs[1]!.content).not.toContain('§result');
        expect(msgs[2]!.content).toBe('done');

        // The UI event for the html marker carries the raw HTML, not the marker text.
        const events = ctx.fns.session.getEvents(ctx, { id: a.id });
        const htmlEvent = events.find((e: any) => e.html === '<div class="card">Hi</div>');
        expect(htmlEvent).toBeDefined();
        expect(htmlEvent.type).toBe('assistant');
    });

    test('§html body is plain HTML — no template interpolation, braces stay as text', async () => {
        const ctx = await setup();
        let turn = 0;
        ctx.fns.llm.stream = async () => {
            turn++;
            if (turn === 1) {
                return {
                    text: '§html\n<div class="card"><h3>{agent.scratchpad.user.name}</h3></div>',
                    toolCalls: [], thinking: '', usage: {},
                };
            }
            return { text: 'done', toolCalls: [], thinking: '', usage: {} };
        };

        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        a.scratchpad.user = { name: 'Иван' };
        ctx.fns.session.save(ctx, { agent: a });

        await run(ctx, a, 'render');

        const events = ctx.fns.session.getEvents(ctx, { id: a.id });
        const htmlEvent = events.find((e: any) => e.type === 'assistant' && e.html?.includes('class="card"'));
        expect(htmlEvent).toBeDefined();
        // Braces are LITERAL — no template engine. "Иван" never appears.
        expect(htmlEvent.html).toBe('<div class="card"><h3>{agent.scratchpad.user.name}</h3></div>');
        expect(htmlEvent.html).not.toContain('Иван');
    });

    test('§html body that is a full HTML document is sanitised down to its inner content', async () => {
        // <!DOCTYPE>/<html>/<body>/<style>/<script> get stripped; inner
        // markup survives. No more parse errors — body is plain HTML.
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
            if (turn === 1) return { text: `§html\n${dirty}`, toolCalls: [], thinking: '', usage: {} };
            return { text: 'done', toolCalls: [], thinking: '', usage: {} };
        };
        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        ctx.fns.session.save(ctx, { agent: a });

        await run(ctx, a, 'render bad');

        const events = ctx.fns.session.getEvents(ctx, { id: a.id });
        const htmlEvent = events.find((e: any) => e.type === 'assistant' && e.html?.includes('<div>x</div>'));
        expect(htmlEvent).toBeDefined();
        expect(htmlEvent.html).toBe('<div>x</div>');
        // No §error:html feedback — nothing to fail anymore.
        const msgs = ctx.fns.session.getMessages(ctx, { id: a.id });
        const errMsg = msgs.find((m: any) => String(m.content ?? '').startsWith('§error:html'));
        expect(errMsg).toBeUndefined();
    });

    test('§bash marker runs `bash -c` and feeds back §result:bash with stdout', async () => {
        const ctx = await setup();
        let turn = 0;
        ctx.fns.llm.stream = async () => {
            turn++;
            if (turn === 1) return { text: '§bash\necho hello-bash', toolCalls: [], thinking: '', usage: {} };
            return { text: 'ok', toolCalls: [], thinking: '', usage: {} };
        };

        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        ctx.fns.session.save(ctx, { agent: a });

        await run(ctx, a, 'run a shell');

        const msgs = ctx.fns.session.getMessages(ctx, { id: a.id });
        expect(msgs.map((m: any) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
        expect(msgs[1]!.content).toBe('§bash\necho hello-bash');
        expect(msgs[2]!.content).toContain('§result:bash');
        expect(msgs[2]!.content).toContain('hello-bash');
        expect(msgs[3]!.content).toBe('ok');
    });

    test('§bash non-zero exit is tagged :error and includes [exit N]', async () => {
        const ctx = await setup();
        let turn = 0;
        ctx.fns.llm.stream = async () => {
            turn++;
            if (turn === 1) return { text: '§bash\nexit 7', toolCalls: [], thinking: '', usage: {} };
            return { text: 'caught', toolCalls: [], thinking: '', usage: {} };
        };

        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        ctx.fns.session.save(ctx, { agent: a });

        await run(ctx, a, 'fail bash');
        const msgs = ctx.fns.session.getMessages(ctx, { id: a.id });
        expect(msgs[2]!.content).toContain('§result:bash:error');
        expect(msgs[2]!.content).toContain('[exit 7]');
    });

    test('eval errors are tagged :error in the result block', async () => {
        const ctx = await setup();
        let turn = 0;
        ctx.fns.llm.stream = async () => {
            turn++;
            if (turn === 1) return { text: '§eval\nthrow new Error("boom");', toolCalls: [], thinking: '', usage: {} };
            return { text: 'caught', toolCalls: [], thinking: '', usage: {} };
        };
        ctx.fns.repl.eval = async () => { throw new Error('boom'); };

        const a = ctx.fns.agent.start(ctx, { model: 'mock:test' });
        ctx.fns.session.save(ctx, { agent: a });

        await run(ctx, a, 'fail');
        const msgs = ctx.fns.session.getMessages(ctx, { id: a.id });
        expect(msgs[2]!.content).toContain('§result:eval:error');
        expect(msgs[2]!.content).toContain('boom');
    });
});
