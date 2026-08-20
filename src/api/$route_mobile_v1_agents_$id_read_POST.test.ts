import { expect, test } from "bun:test";
import route from "./$route_mobile_v1_agents_$id_read_POST";

test("native read endpoint stores the newest event timestamp", async () => {
    const writes: any[] = [];
    const ctx: any = { fns: { procs: { db: {
        select: async () => [{ ts: "1234" }],
        run: async (opts: any) => { writes.push(opts); return { changes: 1 }; },
    } } } };
    const response = await route(ctx, null, { req: new Request("http://localhost/api/mobile/v1/agents/ab/read", { method: "POST" }), params: { id: "ab" } });
    expect(await response.json()).toMatchObject({ ok: true, agentId: "ab", seenAt: 1234 });
    expect(writes[0].params).toEqual(["seen-at:ab", "1234"]);
});
