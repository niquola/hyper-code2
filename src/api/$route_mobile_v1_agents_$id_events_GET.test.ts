import { describe, expect, test } from "bun:test";
import route from "./$route_mobile_v1_agents_$id_events_GET";

describe("GET /api/mobile/v1/agents/:id/events", () => {
    test("filters service events, returns mobile fields, and initially requests the newest page", async () => {
        let eventOpts: any;
        const ctx: any = { fns: {
            procs: { db: { select: async ({ sql }: any) => sql.includes("SELECT 1") ? [{ exists: 1 }] : [{ run_state: "idle", next_run_at: null, last_error: null }] } },
            session: {
                getEvents: async (opts: any) => { eventOpts = opts; return [{ idx: 1, ts: 10, type: "wake_up", reason: "x" }, { idx: 2, ts: 11, type: "assistant", text: "hello", usage: { tokens: 1 } }]; },
                getMaxEventIdx: async () => 2,
            },
        } };
        const response = await route(ctx, null, { req: new Request("http://localhost/api/mobile/v1/agents/ab/events?limit=10"), params: { id: "ab" } });
        expect(eventOpts).toMatchObject({ id: "ab", beforeIdx: 3, limit: 10 });
        expect(await response.json()).toMatchObject({ version: 1, agentId: "ab", nextAfter: 3, isRunning: false, events: [{ idx: 2, type: "assistant", text: "hello" }] });
    });
});
