import { describe, test, expect } from "bun:test";
import route from './$route_$id_archive_POST';

function req(id: string): any {
  const r = new Request(`http://x/agent/${id}/archive`, { method: 'POST' });
  (r as any).params = { id };
  return r;
}

describe('POST /agent/:id/archive', () => {
  test('archives agent, removes it from runtime state, and redirects to home', async () => {
    const calls: any[] = [];
    const ctx: any = {
      state: { agent: { a1: { id: 'a1' } } },
      fns: {
        session: {
          list: () => [{ id: 'a1' }, { id: 'a2' }],
          archive: (_c: any, opts: { id: string }) => { calls.push(['archive', opts.id]); return { ok: true }; },
        },
      },
    };

    const res = await route(ctx, null, req('a1'));
    expect(calls).toEqual([['archive', 'a1']]);
    expect(ctx.state.agent.a1).toBeUndefined();
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/?archived=' + encodeURIComponent('a1'));
  });
});
