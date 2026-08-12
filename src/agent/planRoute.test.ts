import { describe, expect, test } from "bun:test";
import route from "./$route_$id_plan_POST";

describe("POST /agent/:id/plan", () => {
    test("archives by default and permanently deletes only for delete action", async () => {
        const calls: any[] = [];
        const agent = { id: "a1" };
        const ctx: any = { state: { agent: { a1: agent } }, fns: { session: {
            load: () => null,
            removePlan: (opts: any) => calls.push(opts),
            updatePlan: (opts: any) => calls.push(opts),
        } } };
        const archiveReq = new Request("http://x/agent/a1/plan", { method: "POST", body: new URLSearchParams() });
        const archiveRes = await route(ctx, null, { req: archiveReq, params: { id: "a1" } });
        expect(archiveRes.status).toBe(204);
        expect(calls[0]).toEqual({ agent, archive: true });

        const deleteReq = new Request("http://x/agent/a1/plan", { method: "POST", body: new URLSearchParams({ action: "delete" }) });
        await route(ctx, null, { req: deleteReq, params: { id: "a1" } });
        expect(calls[1]).toEqual({ agent, archive: false });
    });

    test("returns 404 for an unknown agent", async () => {
        const ctx: any = { state: { agent: {} }, fns: { session: { load: () => null } } };
        const req = new Request("http://x/agent/no/plan", { method: "POST", body: new URLSearchParams() });
        expect((await route(ctx, null, { req, params: { id: "no" } })).status).toBe(404);
    });
});


    test("updates a structured plan and reports validation errors", async () => {
        const calls: any[] = [];
        const agent = { id: "a1" };
        const ctx: any = { state: { agent: { a1: agent } }, fns: { session: {
            load: () => null,
            updatePlan: (opts: any) => calls.push(opts),
        } } };
        const req = new Request("http://x/agent/a1/plan", { method: "POST", body: new URLSearchParams({
            action: "update", plan: JSON.stringify({ title: "Edited", tasks: [{ id: "a", title: "A" }] }),
        }) });
        expect((await route(ctx, null, { req, params: { id: "a1" } })).status).toBe(204);
        expect(calls[0]).toEqual({ agent, title: "Edited", tasks: [{ id: "a", title: "A" }] });

        ctx.fns.session.updatePlan = () => { throw new Error("bad plan"); };
        const bad = new Request("http://x/agent/a1/plan", { method: "POST", body: new URLSearchParams({ action: "update", plan: "{}" }) });
        const response = await route(ctx, null, { req: bad, params: { id: "a1" } });
        expect(response.status).toBe(400);
        expect(await response.text()).toBe("bad plan");
    });
