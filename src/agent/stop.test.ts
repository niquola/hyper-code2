import { describe, test, expect } from "bun:test";
import stop from './stop';

describe('agent.stop', () => {
  test('writes stop error through db-first helpers', () => {
    const calls: any[] = [];
    const agent: any = { id: 'a1', abortController: { abort() { calls.push('abort'); } }, isStreaming: true };
    const ctx: any = { fns: { session: { appendErrorEvent: (_c: any, id: string, error: string) => calls.push(['appendErrorEvent', id, error]), syncAgentState: () => {} } } };
    const res = stop(ctx, agent);
    expect(res.ok).toBe(true);
    expect(calls[0]).toBe('abort');
    expect(calls[1]).toEqual(['appendErrorEvent', 'a1', 'stopped by user']);
  });
});
