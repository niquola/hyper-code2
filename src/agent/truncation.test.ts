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
        const msgs = await ctx.fns.session.getMessages({ id: agent.id });
        const err = msgs.find((m: any) => String(m.content).startsWith('§error:truncated'));
        expect(err).toBeDefined();
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
