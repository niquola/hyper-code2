import { expect, test } from "bun:test";
import route from "./$route_mobile_v1_agents_$id_DELETE";

test("native delete removes the agent", async () => {
    const ctx: any = { state: { agent: {} }, fns: { session: { delete: async () => ({ ok: true }) }, agent: { clear: async () => {} } } };
    const response = await route(ctx, null, { req: new Request("http://localhost/api/mobile/v1/agents/ab", { method: "DELETE" }), params: { id: "ab" } });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, agentId: "ab" });
});
