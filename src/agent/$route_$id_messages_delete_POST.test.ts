import { describe, test, expect } from "bun:test";
import route from './$route_$id_messages_delete_POST';

function req(id: string, idx: string, mode: string): any {
  const form = new FormData();
  form.set('idx', idx);
  form.set('mode', mode);
  const r = new Request(`http://x/agent/${id}/messages/delete`, { method: 'POST', body: form });
  (r as any).params = { id };
  return r;
}

describe('POST /agent/:id/messages/delete', () => {
  test('delete one redirects back', async () => {
    const calls: any[] = [];
    const ctx: any = { state: { agent: { a1: { id: 'a1' } } }, fns: { session: { load: () => null, deleteMessageAt: (_c: any, opts: { id: string; idx: number }) => { calls.push(['one', opts.id, opts.idx]); return { ok: true }; }, truncateMessagesFrom: () => ({ ok: true }), syncAgentState: () => {} } } };
    const res = await route(ctx, null, req('a1', '2', 'one'));
    expect(res.status).toBe(303);
    expect(calls[0]).toEqual(['one', 'a1', 2]);
  });

  test('delete from redirects back', async () => {
    const calls: any[] = [];
    const ctx: any = { state: { agent: { a1: { id: 'a1' } } }, fns: { session: { load: () => null, deleteMessageAt: () => ({ ok: true }), truncateMessagesFrom: (_c: any, opts: { id: string; from: number }) => { calls.push(['from', opts.id, opts.from]); return { ok: true, from: opts.from }; }, syncAgentState: () => {} } } };
    const res = await route(ctx, null, req('a1', '3', 'from'));
    expect(res.status).toBe(303);
    expect(calls[0]).toEqual(['from', 'a1', 3]);
  });
});
