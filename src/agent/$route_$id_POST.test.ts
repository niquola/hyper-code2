import { describe, test, expect } from 'bun:test';
import { mkTestCtx } from '../_testCtx.entry';

async function mkCtx() {
  const ctx = await mkTestCtx();
  const calls: any[] = [];
  ctx.state.registry.agent.wakeWorker = () => { calls.push(['wakeWorker']); };
  const agent = await ctx.fns.agent.start({ model: 'mock:test', systemPrompt: '' });
  await ctx.fns.session.save({ agent });
  (ctx.state as any).agent = { [agent.id]: agent };
  return { ctx, agent, calls };
}

async function userMessages(ctx: any, id: string): Promise<any[]> {
  return (await ctx.fns.session.getMessages({ id })).filter((m: any) => m.role === 'user');
}

async function nextRunAt(ctx: any, id: string): Promise<any> {
  const row = ((await ctx.fns.procs.db.select({ sql: 'SELECT next_run_at FROM agents WHERE id = ?', params: [id] })) as any[])[0];
  return row?.next_run_at;
}

describe('POST /agent/:id', () => {
  test('plain JSON client gets simplified ack', async () => {
    const { ctx, agent, calls } = await mkCtx();
    const res = await ctx.fns.procs.http.dispatch({ method: 'POST', url: '/agent/' + agent.id, body: 'hi' });
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.ok).toBe(true);
    expect(typeof json.sendAt).toBe('number');
    expect(json.messageIdx).toBe(0);
    expect((await userMessages(ctx, agent.id)).map((m: any) => m.content)).toEqual(['hi']);
    expect(calls.find(c => c[0] === 'wakeWorker')).toBeTruthy();
    expect(await nextRunAt(ctx, agent.id)).toBeTruthy();
  });

  test('htmx submit gets 204 No Content', async () => {
    const { ctx, agent } = await mkCtx();
    const res = await ctx.fns.procs.http.dispatch({
      method: 'POST',
      url: '/agent/' + agent.id,
      body: 'text=' + encodeURIComponent('hello via htmx'),
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'hx-request': 'true' },
    });
    expect(res.status).toBe(204);
    expect((await userMessages(ctx, agent.id)).map((m: any) => m.content)).toEqual(['hello via htmx']);
  });

  test('rejects empty body with 400', async () => {
    const { ctx, agent } = await mkCtx();
    const res = await ctx.fns.procs.http.dispatch({ method: 'POST', url: '/agent/' + agent.id, body: '   ' });
    expect(res.status).toBe(400);
  });

  test('plain browser HTML form submit redirects 303 back to /agent/:id', async () => {
    const { ctx, agent } = await mkCtx();
    const res = await ctx.fns.procs.http.dispatch({
      method: 'POST',
      url: '/agent/' + agent.id,
      body: 'text=' + encodeURIComponent('from a form'),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'accept': 'text/html,application/xhtml+xml',
      },
    });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/agent/' + agent.id);
    expect((await userMessages(ctx, agent.id)).map((m: any) => m.content)).toEqual(['from a form']);
  });

  test('multi-field form (no `text`) is serialized to "name: value" lines', async () => {
    const { ctx, agent } = await mkCtx();
    const body = 'name=' + encodeURIComponent('Иван')
              + '&age=' + encodeURIComponent('30')
              + '&note=' + encodeURIComponent('hello');
    const res = await ctx.fns.procs.http.dispatch({
      method: 'POST',
      url: '/agent/' + agent.id,
      body,
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'accept': 'text/html',
      },
    });
    expect(res.status).toBe(303);
    expect((await userMessages(ctx, agent.id)).map((m: any) => m.content)).toEqual(['name: Иван\nage: 30\nnote: hello']);
  });

  test('text field wins over other fields when both present', async () => {
    const { ctx, agent } = await mkCtx();
    const body = 'text=' + encodeURIComponent('explicit')
              + '&extra=' + encodeURIComponent('ignored');
    await ctx.fns.procs.http.dispatch({
      method: 'POST',
      url: '/agent/' + agent.id,
      body,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect((await userMessages(ctx, agent.id)).map((m: any) => m.content)).toEqual(['explicit']);
  });
});
