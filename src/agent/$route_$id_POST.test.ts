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
      db: {
        exec: (_c: any, sql: string, params: any) => {
          calls.push(['db.exec', sql.replace(/\s+/g, ' ').trim(), params]);
          return { changes: 1, lastInsertRowid: 0 };
        },
      },
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
        wakeWorker: () => { calls.push(['wakeWorker']); },
      },
    },
  } as any;
}

describe('POST /agent/:id', () => {
  test('plain JSON client gets simplified ack', async () => {
    const calls: any[] = [];
    const ctx = mkCtx(calls);
    const res = await route(ctx, null, mkReq('a1', 'hi'));
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.ok).toBe(true);
    expect(typeof json.sendAt).toBe('number');
    expect(json.messageIdx).toBe(0);
    expect(calls.find(c => c[0] === 'appendUserMessage')).toEqual(['appendUserMessage', 'a1', 'hi']);
    expect(calls.find(c => c[0] === 'wakeWorker')).toBeTruthy();
    expect(calls.find(c => c[0] === 'db.exec')[1]).toMatch(/UPDATE agents.*next_run_at/i);
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
    expect(calls.find(c => c[0] === 'appendUserMessage')).toEqual(['appendUserMessage', 'a1', 'hello via htmx']);
  });

  test('rejects empty body with 400', async () => {
    const calls: any[] = [];
    const ctx = mkCtx(calls);
    const res = await route(ctx, null, mkReq('a1', '   '));
    expect(res.status).toBe(400);
  });
});
