import { describe, test, expect } from "bun:test";
import stop from './stop';

describe('agent.stop', () => {
  test('aborts run and clears next_run_at when clearQueue=true', async () => {
    const calls: any[] = [];
    const agent: any = {
      id: 'a1',
      abortController: { abort(reason: any) { calls.push(['abort', reason]); } },
      isStreaming: true,
    };
    const ctx: any = {
      fns: {
        procs: {
          db: { run: (opts: { sql: string; params?: any[] }) => { calls.push(['db.run', opts.sql.replace(/\s+/g, ' ').trim(), opts.params]); return { changes: 1, lastInsertRowid: 0 }; } },
        },
        session: {
          appendErrorEvent: (opts: { id: string; error: string }) => calls.push(['appendErrorEvent', opts.id, opts.error]),
          syncAgentState: () => {},
        },
      },
    };
    const res = await stop(ctx, null, { agent, clearQueue: true });
    expect(res.ok).toBe(true);
    expect(calls[0]).toEqual(['abort', 'stopped_by_user']);
    expect(calls[1][0]).toBe('db.run');
    expect(calls[1][1]).toMatch(/UPDATE agents .*run_state = 'idle'.*next_run_at = NULL/);
    expect(calls[2]).toEqual(['appendErrorEvent', 'a1', 'stopped by user; queue cleared']);
  });

  test('without clearQueue keeps next_run_at', async () => {
    const calls: any[] = [];
    const agent: any = {
      id: 'a1',
      abortController: { abort() {} },
      isStreaming: true,
    };
    const ctx: any = {
      fns: {
        procs: {
          db: { run: (opts: { sql: string; params?: any[] }) => { calls.push(opts.sql.replace(/\s+/g, ' ').trim()); return { changes: 1, lastInsertRowid: 0 }; } },
        },
        session: { appendErrorEvent: () => {}, syncAgentState: () => {} },
      },
    };
    await stop(ctx, null, { agent, clearQueue: false });
    expect(calls[0]).toMatch(/next_run_at = next_run_at/);
  });
});
