import { expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

test("setSleepActive persists reversible explicit generation switching", async () => {
    const ctx: any = await mkTestCtx();
    const agent = await ctx.fns.agent.start({ model: "mock:test" });
    agent.sleepContext = {
        mode: "full", activeRevision: null, draftRevision: 2,
        generations: [{ revision: 1 }, { revision: 2 }],
    };
    await ctx.fns.procs.db.run({ sql: "UPDATE agents SET sleep_context = ?::jsonb WHERE id = ?", params: [JSON.stringify(agent.sleepContext), agent.id] });
    const active = await ctx.fns.agent.setSleepActive({ id: agent.id, active: true, revision: 2 });
    expect(active).toEqual({ active: true, revision: 2 });
    expect(agent.sleepContext.mode).toBe("compact");
    expect(agent.sleepContext.draftRevision).toBeNull();
    expect((await ctx.fns.agent.setSleepActive({ id: agent.id, active: false })).active).toBe(false);
    expect(agent.sleepContext.mode).toBe("full");
});
