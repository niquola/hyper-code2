import { describe, test, expect } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe('POST /agent/:id/archive', () => {
  test('archives agent, removes it from runtime state, and redirects to home', async () => {
    const ctx = await mkTestCtx();
    const calls: any[] = [];
    ctx.state.registry.session.archive = (_c: any, _s: any, o: { id: string }) => {
      calls.push(['archive', o.id]);
      return { ok: true };
    };
    (ctx.state as any).agent = { a1: { id: 'a1' } };

    const res = await ctx.fns.procs.http.dispatch({ method: 'POST', url: '/agent/a1/archive' });
    expect(calls).toEqual([['archive', 'a1']]);
    expect((ctx.state as any).agent.a1).toBeUndefined();
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/?archived=' + encodeURIComponent('a1'));
  });
});
