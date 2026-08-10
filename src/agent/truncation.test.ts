import { describe, test, expect } from 'bun:test';
import { mkTestCtx } from '../_testCtx.entry';

describe('big results → scratchpad variable', () => {
    test('oversized eval result is stashed, transcript gets preview + pointer', async () => {
        const ctx = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: 'mock:echo' });
        await ctx.fns.session.save({ agent });
        const big = Array.from({ length: 3000 }, (_, i) => `line-${i}`).join('\n');
        ctx.state.registry.repl.eval = async () => big;

        await ctx.fns.agent.executeMarker({ agent, call: { kind: 'eval', content: 'x' } });

        const msgs = await ctx.fns.session.getMessages({ id: agent.id });
        const result = msgs[msgs.length - 1]!;
        expect(String(result.content).length).toBeLessThan(4000);
        expect(result.content).toContain('agent.scratchpad.results["r1"]');
        expect(result.content).toContain('line-0');                 // head preview
        const fresh = await ctx.fns.session.load({ id: agent.id });
        expect(fresh!.scratchpad.results.r1).toBe(big);             // full text persisted
    });

    test('bash keeps the TAIL (errors live at the end); old stashes pruned', async () => {
        const ctx = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: 'mock:echo' });
        await ctx.fns.session.save({ agent });
        const big = Array.from({ length: 3000 }, (_, i) => `out-${i}`).join('\n') + '\nFATAL: the end';
        ctx.state.registry.agent.executeBash = async () => ({ output: big, isError: true });

        await ctx.fns.agent.executeMarker({ agent, call: { kind: 'bash', content: 'x' } });
        const msgs = await ctx.fns.session.getMessages({ id: agent.id });
        expect(msgs[msgs.length - 1]!.content).toContain('FATAL: the end');

        for (let i = 0; i < 7; i++) await ctx.fns.agent.stashResult({ agent, output: 'y'.repeat(7000), kind: 'eval' });
        expect(Object.keys(agent.scratchpad.results).length).toBeLessThanOrEqual(6);
        expect(agent.scratchpad.results.r1).toBeUndefined();        // oldest pruned
    });
});

describe('token-limit truncation guard', () => {
    test('markers from a length-cut reply are NOT executed', async () => {
        const ctx = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: 'mock:echo' });
        await ctx.fns.session.save({ agent });
        let evals = 0;
        ctx.state.registry.repl.eval = async () => { evals++; return 'ran'; };
        let call = 0;
        ctx.state.registry.llm.stream = async () => (++call === 1
            ? { text: '§eval\nconsole.log("half-written', usage: {}, finishReason: 'length' }
            : { text: 'recovered.', usage: {}, finishReason: 'stop' });

        await ctx.fns.agent.run({ agent, userText: 'go' });

        expect(evals).toBe(0);                                      // nothing executed
        // the note is collapsed from the LLM view after the clean close — audit keeps it
        const msgs = await ctx.fns.session.getMessages({ id: agent.id, includeExcluded: true });
        const err = msgs.find((m: any) => String(m.content).startsWith('§error:truncated'));
        expect(err).toBeDefined();
        expect(err.excluded_from_llm).toBe(true);
        const flag = (await ctx.fns.procs.db.select({
            sql: "SELECT excluded_from_cursor FROM messages WHERE agent_id = ? AND content LIKE '§error:truncated%'",
            params: [agent.id],
        }))[0];
        expect(Number(flag.excluded_from_cursor)).toBe(1);          // doesn't retrigger the worker
        expect(msgs[msgs.length - 1]!.content).toBe('recovered.');  // loop continued and closed
    });
});

describe('§write parse warning', () => {
    test('a .ts file that does not parse gets an actionable WARNING in the result', async () => {
        const ctx = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: 'mock:echo' });
        await ctx.fns.session.save({ agent });
        await ctx.fns.agent.executeMarker({ agent, call: { kind: 'write', path: '.test-tmp/bad.ts', content: 'const a = 1;\nэто проза в файле' } });
        const msgs = await ctx.fns.session.getMessages({ id: agent.id });
        const res = String(msgs[msgs.length - 1]!.content);
        expect(res).toContain('wrote .test-tmp/bad.ts');
        expect(res).toContain('does NOT parse');
        expect(res).toContain('bare § line');
    });
});

describe('NUL bytes in marker output', () => {
    test('a result with \\u0000 survives the pg INSERT (scrubbed, run alive)', async () => {
        const ctx = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: 'mock:echo' });
        await ctx.fns.session.save({ agent });
        ctx.state.registry.repl.eval = async () => 'binary\u0000junk\u0000here';
        await ctx.fns.agent.executeMarker({ agent, call: { kind: 'eval', content: 'x' } });
        const msgs = await ctx.fns.session.getMessages({ id: agent.id });
        const res = String(msgs[msgs.length - 1]!.content);
        expect(res).toContain('binary');
        expect(res).not.toContain('\u0000');
    });
});

describe('eval parse-error diagnosis', () => {
    test('trailing prose in the body is named in the error with the close hint', async () => {
        const ctx = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: 'mock:echo' });
        await ctx.fns.session.save({ agent });
        // real eval (mkTestCtx stubs it — restore the app wrapper over procs.repl.eval)
        const rawEval = (await import('../repl/eval')).default;
        ctx.state.registry.repl.eval = rawEval;
        await ctx.fns.agent.executeMarker({ agent, call: { kind: 'eval',
            content: 'console.log("updated tests");  crap appended? use explicit close next.' } });
        const msgs = await ctx.fns.session.getMessages({ id: agent.id });
        const res = String(msgs[msgs.length - 1]!.content);
        expect(res).toContain('not code');
        expect(res).toContain('crap appended');
        expect(res).toContain('bare \u00a7 line'.replace('\u00a7', String.fromCharCode(0xa7)));
    });
});

describe('fail-fast marker chain', () => {
    test('markers after a failed one are skipped with a note', async () => {
        const ctx = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: 'mock:echo' });
        await ctx.fns.session.save({ agent });
        let call = 0;
        ctx.state.registry.repl.eval = async () => { throw new Error('boom'); };
        let wrote = 0;
        ctx.state.registry.files.write = async () => { wrote++; };
        ctx.state.registry.llm.stream = async () => (++call === 1
            ? { text: '\u00a7eval\nbad()\n\u00a7write:.test-tmp/x.txt\nhello', usage: {}, finishReason: 'stop' }
            : { text: 'done.', usage: {}, finishReason: 'stop' });

        await ctx.fns.agent.run({ agent, userText: 'go' });

        expect(wrote).toBe(0);  // the §write after the failed §eval did NOT run
        const msgs = await ctx.fns.session.getMessages({ id: agent.id });
        const skipped = msgs.find((m: any) => String(m.content).includes('skipped: earlier'));
        expect(skipped).toBeDefined();
    });
});

describe('corrected failures collapse out of the LLM view', () => {
    test('failed eval pair is excluded after a successful retry; UI gets the badge', async () => {
        const ctx = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: 'mock:echo' });
        await ctx.fns.session.save({ agent });
        let evals = 0;
        ctx.state.registry.repl.eval = async () => {
            if (++evals === 1) throw new Error('boom-first');
            return 'fine';
        };
        let call = 0;
        ctx.state.registry.llm.stream = async () => (++call === 1
            ? { text: '\u00a7eval\nbad()', usage: {}, finishReason: 'stop' }
            : call === 2
                ? { text: '\u00a7eval\ngood()', usage: {}, finishReason: 'stop' }
                : { text: 'done.', usage: {}, finishReason: 'stop' });

        await ctx.fns.agent.run({ agent, userText: 'go' });

        const llmView = await ctx.fns.session.getMessages({ id: agent.id });
        const audit = await ctx.fns.session.getMessages({ id: agent.id, includeExcluded: true });
        expect(JSON.stringify(llmView)).not.toContain('boom-first');   // collapsed from LLM view
        expect(JSON.stringify(audit)).toContain('boom-first');         // audit intact
        expect(JSON.stringify(llmView)).toContain('fine');             // the fix stays

        const evs = await ctx.fns.session.getEvents({ id: agent.id });
        const collapsed = evs.find((e: any) => e.excludedFromLlm);
        expect(collapsed).toBeDefined();
        const html = await ctx.fns.agent.renderEventHtml({ event: collapsed, agentId: agent.id });
        expect(html).toContain('вне контекста');
        expect(html).toContain('opacity-50');
    });
});
