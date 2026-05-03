import { describe, test, expect } from 'bun:test';
import uiEval from './eval';
import action from './action';
import pending from './pending';

const mkCtx = () => ({
  state: {},
  fns: {
    events: { emit(ctx: any, opts: { event: any }) { ((ctx.state as any).emitted ??= []).push(opts.event); } },
  },
}) as unknown as Context;

describe('ui eval transport', () => {
  test('ui.eval registers pending entry and emits SSE event', async () => {
    const ctx: any = mkCtx();
    const res = await uiEval(ctx, { code: '1 + 1' });
    expect(res.id.startsWith('uieval_')).toBe(true);
    expect(ctx.state.emitted[0].type).toBe('ui.eval');
    const item = await pending(ctx, { id: res.id });
    expect(item.code).toBe('1 + 1');
    expect(item.status).toBe('pending');
  });

  test('ui.action registers pending entry and emits action event', async () => {
    const ctx: any = mkCtx();
    const res = await action(ctx, { name: 'ping', args: { a: 1 } });
    expect(res.id.startsWith('uiaction_')).toBe(true);
    expect(ctx.state.emitted[0].type).toBe('ui.action');
    const item = await pending(ctx, { id: res.id });
    expect(item.action).toBe('ping');
  });
});
