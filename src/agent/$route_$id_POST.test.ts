import { describe, test, expect } from "bun:test";
import route from "./$route_$id_POST";

function mkReq(id: string, body: string): any {
  const req = new Request(`http://x/agent/` + id, { method: 'POST', body });
  (req as any).params = { id };
  return req;
}

describe('POST /agent/:id', () => {
  test('starts run without optimistic user event append', async () => {
    const calls: any[] = [];
    const agent: any = { id: 'a1', events: [], isStreaming: false };
    const ctx: any = {
      state: { agent: { a1: agent } },
      fns: {
        session: {
          appendEvent: (_c: any, id: string, ev: any) => { calls.push(['appendEvent', id, ev]); },
          syncAgentState: (_c: any, a: any) => a,
        },
        agent: { run: async () => {} },
      },
    };
    const res = await route(ctx, null, mkReq('a1', 'hi'));
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(0);
    expect(agent.isStreaming).toBe(true);
  });
});
