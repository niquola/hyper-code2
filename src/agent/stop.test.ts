import { describe, test, expect } from "bun:test";
import stop from './stop';

describe('agent.stop', () => {
  test('aborts current job and can clear queue', () => {
    const calls: any[] = [];
    const agent: any = {
      id: 'a1',
      currentJobId: 'job1',
      abortController: { abort(reason: any) { calls.push(['abort', reason]); } },
      isStreaming: true,
    };
    const ctx: any = {
      fns: {
        db: { exec: (_c: any, sql: string, params: any[]) => calls.push(['db.exec', sql, params]) },
        session: {
          appendErrorEvent: (_c: any, id: string, error: string) => calls.push(['appendErrorEvent', id, error]),
          syncAgentState: () => {},
        },
      },
    };
    const res = stop(ctx, agent, { clearQueue: true });
    expect(res.ok).toBe(true);
    expect(calls[0][0]).toBe('db.exec');
    expect(calls[1][0]).toBe('db.exec');
    expect(calls[2]).toEqual(['abort', 'stopped_by_user']);
    expect(calls[3]).toEqual(['appendErrorEvent', 'a1', 'stopped by user; queue cleared']);
  });
});
