import { describe, test, expect } from 'bun:test';
import { mkTestCtx } from '../_testCtx.entry';

async function mkAgent(ctx: any, turns: any[]) {
    const agent = await ctx.fns.agent.start({ model: 'mock:test' });
    agent.scratchpad.mockLLM = { turns, defaultText: 'done' };
    await ctx.fns.session.save({ agent });
    return agent;
}

describe('agent.run', () => {
    test('a tool call round-trips: assistant row carries the call, a tool row answers it by id', async () => {
        const ctx: any = await mkTestCtx();
        ctx.fns.files.read = async (_c: any, _s: any, o: any) => `CONTENT OF ${o.path}`;

        const agent = await mkAgent(ctx, [
            { text: 'Смотрю файл.', toolCalls: [{ name: 'read', args: { path: 'src/x.ts' } }] },
            { text: 'Там лежит контент.' },
        ]);
        await ctx.fns.agent.run({ agent, userText: 'что в файле?' });

        const msgs = await ctx.fns.session.getMessages({ id: agent.id });
        expect(msgs.map((m: any) => m.role)).toEqual(['user', 'assistant', 'tool', 'assistant']);

        const call = msgs[1]!.tool_calls[0];
        expect(call).toMatchObject({ name: 'read', args: { path: 'src/x.ts' } });
        expect(msgs[2]!.tool_call_id).toBe(call.id);
        expect(msgs[2]!.content).toBe('CONTENT OF src/x.ts');
        expect(msgs[3]!.content).toBe('Там лежит контент.');

        // the UI renders from events, so the call has to show up there too
        const events = await ctx.fns.session.getEvents({ id: agent.id });
        const toolEvent = events.find((e: any) => e.type === 'tool_call');
        expect(toolEvent).toMatchObject({ name: 'read', isError: false });
    });

    test('parallel calls in one reply each get their own answer', async () => {
        const ctx: any = await mkTestCtx();
        ctx.fns.files.read = async (_c: any, _s: any, o: any) => `READ:${o.path}`;
        ctx.fns.files.grep = async () => [{ path: 'a.ts', line: 1, column: 2, text: 'hit' }];

        const agent = await mkAgent(ctx, [
            { toolCalls: [
                { name: 'read', args: { path: 'a.ts' } },
                { name: 'grep', args: { pattern: 'hit' } },
            ] },
            { text: 'оба готовы' },
        ]);
        await ctx.fns.agent.run({ agent, userText: 'go' });

        const msgs = await ctx.fns.session.getMessages({ id: agent.id });
        expect(msgs.map((m: any) => m.role)).toEqual(['user', 'assistant', 'tool', 'tool', 'assistant']);
        expect(msgs[1]!.tool_calls).toHaveLength(2);
        expect(msgs[2]!.content).toBe('READ:a.ts');
        expect(msgs[3]!.content).toBe('a.ts:1:2: hit');
        expect([msgs[2]!.tool_call_id, msgs[3]!.tool_call_id])
            .toEqual(msgs[1]!.tool_calls.map((c: any) => c.id));
    });

    test('a bad argument comes back as the tool answer, and the loop keeps going', async () => {
        const ctx: any = await mkTestCtx();
        const agent = await mkAgent(ctx, [
            { toolCalls: [{ name: 'read', args: { path: 'a.ts', maxLine: 3 } }] },
            { text: 'понял, опция называется maxLines' },
        ]);
        await ctx.fns.agent.run({ agent, userText: 'go' });

        const msgs = await ctx.fns.session.getMessages({ id: agent.id });
        expect(msgs[2]!.role).toBe('tool');
        expect(msgs[2]!.content).toContain('unknown option "maxLine"');
        expect(msgs[3]!.content).toContain('maxLines');

        const events = await ctx.fns.session.getEvents({ id: agent.id });
        expect(events.find((e: any) => e.type === 'tool_call')!.isError).toBe(true);
    });


    test('tool schemas go on the wire in the endpoint dialect', async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: 'mock:test' });

        const wire = ctx.fns.agent.wireTools({ agent, api: 'anthropic' });
        expect(wire.map((t: any) => t.name).sort()).toEqual(['bash', 'edit', 'eval', 'grep', 'read', 'write']);

        const narrowed = ctx.fns.agent.wireTools({ agent: { ...agent, tools: ['read'] }, api: 'openai' });
        expect(narrowed).toHaveLength(1);
    });
});

describe('transcript surgery keeps JSON pairs intact', () => {
    async function withPair(ctx: any) {
        ctx.fns.files.read = async () => 'FILE';
        const agent = await ctx.fns.agent.start({ model: 'mock:test' });
            agent.scratchpad.mockLLM = { turns: [
            { toolCalls: [{ name: 'read', args: { path: 'a.ts' } }] },
            { text: 'готово' },
        ] };
        await ctx.fns.session.save({ agent });
        await ctx.fns.agent.run({ agent, userText: 'go' });
        return agent;
    }

    test('deleting half a JSON pair is refused, like half a marker pair', async () => {
        const ctx: any = await mkTestCtx();
        const agent = await withPair(ctx);
        const msgs = await ctx.fns.session.getMessages({ id: agent.id });
        const callIdx = 1, resultIdx = 2;

        expect(await ctx.fns.session.deleteMessageAt({ id: agent.id, idx: callIdx }))
            .toMatchObject({ ok: false });
        expect(await ctx.fns.session.deleteMessageAt({ id: agent.id, idx: resultIdx }))
            .toMatchObject({ ok: false });
        expect((await ctx.fns.session.getMessages({ id: agent.id })).length).toBe(msgs.length);
    });

    test('truncating into a pair walks back to the call', async () => {
        const ctx: any = await mkTestCtx();
        const agent = await withPair(ctx);

        // idx 2 is the tool result — cutting there must take its call with it
        await ctx.fns.session.truncateMessagesFrom({ id: agent.id, from: 2 });
        const msgs = await ctx.fns.session.getMessages({ id: agent.id });
        expect(msgs.map((m: any) => m.role)).toEqual(['user']);
    });

    test('rewriting the transcript preserves tool_calls and tool_call_id', async () => {
        const ctx: any = await mkTestCtx();
        const agent = await withPair(ctx);

        const before = await ctx.fns.session.getMessages({ id: agent.id });
        await ctx.fns.session.replaceMessages({ id: agent.id, messages: before });
        const after = await ctx.fns.session.getMessages({ id: agent.id });

        expect(after[1]!.tool_calls).toEqual(before[1]!.tool_calls);
        expect(after[2]!.tool_call_id).toBe(before[1]!.tool_calls[0].id);

        // …and so does session.save, which rewrites every row from memory
        await ctx.fns.session.syncAgentState({ agent });
        await ctx.fns.session.save({ agent });
        const saved = await ctx.fns.session.getMessages({ id: agent.id });
        expect(saved[1]!.tool_calls[0].name).toBe('read');
        expect(saved[2]!.tool_call_id).toBe(saved[1]!.tool_calls[0].id);
    });

    test('a reply truncated mid-arguments executes nothing and says so', async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: 'mock:test' });
            let ran = 0;
        ctx.fns.tools.read = async () => { ran++; return 'x'; };
        ctx.fns.llm.stream = async () => ({
            text: '', usage: null, finishReason: 'length',
            toolCalls: [{ id: 'c1', name: 'read', args: { __unparsed: '{"path": "a.t' } }],
        });
        await ctx.fns.session.save({ agent });

        const turns: any[] = [];
        ctx.fns.llm.stream = async () => turns.length++
            ? { text: 'ok', usage: null, finishReason: 'stop', toolCalls: [] }
            : { text: '', usage: null, finishReason: 'length', toolCalls: [{ id: 'c1', name: 'read', args: { __unparsed: '{"path": "a.t' } }] };

        await ctx.fns.agent.run({ agent, userText: 'go' });
        const msgs = await ctx.fns.session.getMessages({ id: agent.id, includeExcluded: true });
        expect(ran).toBe(0);
        expect(msgs.some((m: any) => String(m.content).includes('cut off mid-call'))).toBe(true);
    });
});
