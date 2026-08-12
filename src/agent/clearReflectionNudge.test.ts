import { expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

test("clearReflectionNudge persists and updates live agent", async () => {
    const ctx: any = await mkTestCtx();
    const agent = await ctx.fns.agent.start({ model: "mock:test" });
    agent.reflection = { revision: 1, state: { reflectionNudge: { text: "verify", expiresAfterTurns: 3 } } };
    await ctx.fns.procs.db.run({ sql: "UPDATE agents SET reflection = ?::jsonb WHERE id = ?", params: [JSON.stringify(agent.reflection), agent.id] });
    expect(await ctx.fns.agent.clearReflectionNudge({ id: agent.id })).toEqual({ cleared: true });
    expect(agent.reflection.state.reflectionNudge).toBeNull();
    expect(await ctx.fns.agent.statusLineForTurn({ agent })).not.toContain("Reflection nudge");
    expect(await ctx.fns.agent.clearReflectionNudge({ id: agent.id })).toEqual({ cleared: false });
});
