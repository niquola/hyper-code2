import { expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";
import goalRoute from "./$route_$id_goal_POST";

test("goal route explicitly enables and disables goal", async () => {
    const ctx: any = await mkTestCtx();
    const agent = await ctx.fns.agent.start({ model: "mock:test" });
    const request = (enabled: string) => new Request(`http://test/agent/${agent.id}/goal`, { method: "POST", body: new URLSearchParams({ statement: "ship it", iterations: "4", enabled }) });
    await goalRoute(ctx, null, { req: request("1"), params: { id: agent.id } });
    expect(agent.goal.enabled).toBe(true);
    expect(agent.goal.maxIterations).toBe(4);
    await goalRoute(ctx, null, { req: request("0"), params: { id: agent.id } });
    const rows = await ctx.fns.procs.db.select({ sql: "SELECT message_type FROM messages WHERE agent_id = ? ORDER BY idx", params: [agent.id] });
    expect(rows.some((row: any) => row.message_type === "goal_activation")).toBe(true);
    const scheduled = (await ctx.fns.procs.db.select({ sql: "SELECT next_run_at FROM agents WHERE id = ?", params: [agent.id] }))[0];
    expect(scheduled.next_run_at).not.toBeNull();
    expect(agent.goal.enabled).toBe(false);
});
