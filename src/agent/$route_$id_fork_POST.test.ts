import { describe, test, expect } from "bun:test";
import route from './$route_$id_fork_POST';

function req(id: string): any {
  const r = new Request(`http://x/agent/${id}/fork`, { method: 'POST' });
  (r as any).params = { id };
  return r;
}

describe('POST /agent/:id/fork', () => {
  test('forks and redirects to child agent page', async () => {
    const ctx: any = {
      state: { agent: { a1: { id: 'a1' } } },
      fns: { session: { load: () => null, fork: (_c: any, opts: { id: string }) => ({ id: opts.id + '-child' }) } },
    };
    const res = await route(ctx, null, req('a1'));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/agent/a1-child');
  });

  test('404 if agent not found', async () => {
    const ctx: any = { state: { agent: {} }, fns: { session: { load: () => null } } };
    const res = await route(ctx, null, req('missing'));
    expect(res.status).toBe(404);
  });
});
