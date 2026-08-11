import { describe, test, expect } from 'bun:test';
import repair from './repairToolPairs';

const run = (messages: any[]) => repair(null as any, null, { messages });

describe('session.repairToolPairs', () => {
    test('a call with no result gets a synthetic answer right after it', () => {
        const { messages, repaired } = run([
            { role: 'user', content: 'go' },
            { role: 'assistant', content: '', tool_calls: [{ id: 'c1', name: 'bash', args: {} }] },
            { role: 'user', content: 'ты там живой?' },
        ]);

        expect(messages.map((m: any) => m.role)).toEqual(['user', 'assistant', 'tool', 'user']);
        expect(messages[2]).toMatchObject({ tool_call_id: 'c1', excluded_from_cursor: true });
        expect(messages[2].content).toContain('interrupted');
        expect(repaired).toEqual([{ id: 'c1', name: 'bash', afterIdx: 1 }]);
    });

    test('an answered call is left exactly as it was', () => {
        const original = [
            { role: 'assistant', content: '', tool_calls: [{ id: 'c1', name: 'read', args: {} }] },
            { role: 'tool', content: 'FILE', tool_call_id: 'c1' },
        ];
        const { messages, repaired } = run(original);
        expect(messages).toEqual(original);
        expect(repaired).toHaveLength(0);
    });

    test('parallel calls are closed one by one, in order', () => {
        const { messages, repaired } = run([
            { role: 'assistant', content: '', tool_calls: [
                { id: 'a', name: 'read', args: {} },
                { id: 'b', name: 'grep', args: {} },
            ] },
            { role: 'tool', content: 'only b answered', tool_call_id: 'b' },
        ]);

        // 'b' already has its answer, so only 'a' is closed — and the synthetic
        // row lands next to its call, not at the end of the transcript.
        expect(repaired.map(r => r.id)).toEqual(['a']);
        expect(messages.map((m: any) => m.role)).toEqual(['assistant', 'tool', 'tool']);
        expect(messages[1].tool_call_id).toBe('a');
        expect(messages[2].tool_call_id).toBe('b');
    });
});
