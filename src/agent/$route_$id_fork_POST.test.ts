import { describe, test, expect } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe('POST /agent/:id/fork', () => {
  test('forks and redirects to child agent page', async () => {
    const ctx = await mkTestCtx();
    ctx.state.registry.session.load = () => null;
    ctx.state.registry.session.fork = (_c: any, _s: any, o: { id: string }) => ({ id: o.id + '-child' });
    (ctx.state as any).agent = { a1: { id: 'a1' } };

    const res = await ctx.fns.procs.http.dispatch({ method: 'POST', url: '/agent/a1/fork' });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/agent/a1-child');
  });

  test('404 if agent not found', async () => {
    const ctx = await mkTestCtx();
    ctx.state.registry.session.load = () => null;
    (ctx.state as any).agent = {};

    const res = await ctx.fns.procs.http.dispatch({ method: 'POST', url: '/agent/missing/fork' });
    expect(res.status).toBe(404);
  });
});
