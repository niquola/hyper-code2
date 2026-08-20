import { expect, test } from "bun:test";
import route from "./$route_mobile_v1_agents_$id_events_$idx_GET";

test("mobile tool detail bounds large results", async () => {
    const payload = JSON.stringify({ type: "tool_call", name: "bash", args: { command: "echo ok" }, result: "x".repeat(130_000), isError: false });
    const ctx: any = { fns: { procs: { db: { select: async () => [{ idx: 7, type: "tool_call", payload, ts: 10 }] } } } };
    const response = await route(ctx, null, { req: new Request("http://localhost/api/mobile/v1/agents/ab/events/7"), params: { id: "ab", idx: "7" } });
    const body: any = await response.json();
    expect(body.event).toMatchObject({ idx: 7, name: "bash", resultTruncated: true, isError: false });
    expect(body.event.result.length).toBe(120_000);
});
