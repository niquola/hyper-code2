import { describe, test, expect } from 'bun:test';
import route from './$route_$id_POST';

function mkReq(id: string, body: string, query = ''): any {
  const req = new Request('http://x/agent/' + id + query, { method: 'POST', body });
  (req as any).params = { id };
  return req;
}

function mkCtx(calls: any[]) {
  const agent: any = { id: 'a1', events: [] };
  return {
    state: { agent: { a1: agent } },
    fns: {
      session: {
        appendUserMessage: async (_c: any, id: string, text: string) => {
          calls.push(['appendUserMessage', id, text]);
          return { idx: 0 };
        },
        appendErrorEvent: async () => {},
        syncAgentState: (_c: any, a: any) => a,
        load: () => null,
      },
      agent: {
        enqueue: (_c: any, _a: any, text: string, opts: any) => {
          calls.push(['enqueue', text, opts]);
          return { id: 'job1', sendAt: 123 };
        },
        wakeWorker: () => { calls.push(['wakeWorker']); },
      },
    },
  } as any;
}

describe('POST /agent/:id', () => {
  test('plain JSON client gets simplified ack — long-poll delivers the event', async () => {
    const calls: any[] = [];
    const ctx = mkCtx(calls);
    const res = await route(ctx, null, mkReq('a1', 'hi'));
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.ok).toBe(true);
    expect(json.jobId).toBe('job1');
    expect(json.messageIdx).toBe(0);
    expect(calls[0]).toEqual(['appendUserMessage', 'a1', 'hi']);
    expect(calls[1]).toEqual(['enqueue', 'hi', { debounceSeconds: 5, messageIdx: 0 }]);
    // POST no longer drains directly — the single workerLoop handles it.
  });

  test('htmx submit gets 204 No Content', async () => {
    const calls: any[] = [];
    const ctx = mkCtx(calls);
    const req = new Request('http://x/agent/a1', {
      method: 'POST',
      body: 'text=' + encodeURIComponent('hello via htmx'),
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'hx-request': 'true' },
    });
    (req as any).params = { id: 'a1' };
    const res = await route(ctx, null, req);
    expect(res.status).toBe(204);
    expect(calls[0]).toEqual(['appendUserMessage', 'a1', 'hello via htmx']);
  });

  test('rejects empty body with 400', async () => {
    const calls: any[] = [];
    const ctx = mkCtx(calls);
    const res = await route(ctx, null, mkReq('a1', '   '));
    expect(res.status).toBe(400);
  });
});
