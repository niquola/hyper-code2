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
        exec: (_c: any, opts: { sql: string; params?: any }) => {
          calls.push(['db.exec', opts.sql.replace(/\s+/g, ' ').trim(), opts.params]);
          return { changes: 1, lastInsertRowid: 0 };
        },
      },
      session: {
        appendUserMessage: async (_c: any, opts: { id: string; text: string }) => {
          calls.push(['appendUserMessage', opts.id, opts.text]);
          return { idx: 0 };
        },
        appendErrorEvent: async () => {},
        syncAgentState: (_c: any, opts: { agent: any }) => opts.agent,
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

  test('plain browser HTML form submit redirects 303 back to /agent/:id', async () => {
    const calls: any[] = [];
    const ctx = mkCtx(calls);
    const req = new Request('http://x/agent/a1', {
      method: 'POST',
      body: 'text=' + encodeURIComponent('from a form'),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'accept': 'text/html,application/xhtml+xml',
      },
    });
    (req as any).params = { id: 'a1' };
    const res = await route(ctx, null, req);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/agent/a1');
    expect(calls.find(c => c[0] === 'appendUserMessage')).toEqual(['appendUserMessage', 'a1', 'from a form']);
  });

  test('multi-field form (no `text`) is serialized to "name: value" lines', async () => {
    const calls: any[] = [];
    const ctx = mkCtx(calls);
    const body = 'name=' + encodeURIComponent('Иван')
              + '&age=' + encodeURIComponent('30')
              + '&note=' + encodeURIComponent('hello');
    const req = new Request('http://x/agent/a1', {
      method: 'POST',
      body,
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'accept': 'text/html',
      },
    });
    (req as any).params = { id: 'a1' };
    const res = await route(ctx, null, req);
    expect(res.status).toBe(303);
    const submitted = calls.find(c => c[0] === 'appendUserMessage');
    expect(submitted).toEqual(['appendUserMessage', 'a1', 'name: Иван\nage: 30\nnote: hello']);
  });

  test('text field wins over other fields when both present', async () => {
    const calls: any[] = [];
    const ctx = mkCtx(calls);
    const body = 'text=' + encodeURIComponent('explicit')
              + '&extra=' + encodeURIComponent('ignored');
    const req = new Request('http://x/agent/a1', {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    (req as any).params = { id: 'a1' };
    await route(ctx, null, req);
    expect(calls.find(c => c[0] === 'appendUserMessage')).toEqual(['appendUserMessage', 'a1', 'explicit']);
  });
});
