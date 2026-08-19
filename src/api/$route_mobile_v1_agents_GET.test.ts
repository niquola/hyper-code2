import { describe, expect, test } from "bun:test";
import route from "./$route_mobile_v1_agents_GET";

describe("GET /api/mobile/v1/agents", () => {
    test("returns a stable native-client envelope", async () => {
        const ctx: any = { fns: { session: { list: async () => [{ id: "ab", title: "Agent", model: "test:model", runState: "idle", unread: 2, turns: 3, updatedAt: 10, delegated: false }] } } };
        const response = await route(ctx, null, { req: new Request("http://localhost/api/mobile/v1/agents"), params: {} });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ version: 1, agents: [{ id: "ab", title: "Agent", model: "test:model", runState: "idle", unread: 2, turns: 3, updatedAt: 10, delegated: false }] });
    });
});
