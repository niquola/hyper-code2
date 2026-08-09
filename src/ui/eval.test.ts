import { describe, test, expect } from 'bun:test';
import { mkTestCtx } from '../_testCtx.entry';

const mkCtx = async () => {
  const ctx: any = await mkTestCtx();
  const emitted: any[] = [];
  ctx.fns.procs.events.subscribe({ handler: (e: any) => emitted.push(e) });
  return { ctx, emitted };
};

describe('ui eval transport', () => {
  test('ui.eval registers pending entry and emits SSE event', async () => {
    const { ctx, emitted } = await mkCtx();
    const res = await ctx.fns.ui.eval({ code: '1 + 1' });
    expect(res.id.startsWith('uieval_')).toBe(true);
    expect(emitted[0].type).toBe('ui.eval');
    const item = await ctx.fns.ui.pending({ id: res.id });
    expect(item.code).toBe('1 + 1');
    expect(item.status).toBe('pending');
  });

  test('ui.action registers pending entry and emits action event', async () => {
    const { ctx, emitted } = await mkCtx();
    const res = await ctx.fns.ui.action({ name: 'ping', args: { a: 1 } });
    expect(res.id.startsWith('uiaction_')).toBe(true);
    expect(emitted[0].type).toBe('ui.action');
    const item = await ctx.fns.ui.pending({ id: res.id });
    expect(item.action).toBe('ping');
  });
});
