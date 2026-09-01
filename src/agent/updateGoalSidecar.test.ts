import { describe, expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("agent.updateGoalSidecar", () => {
    test("forks a hidden observer and stores display-only goals on the parent", async () => {
        const ctx: any = await mkTestCtx();
        const parent = await ctx.fns.agent.start({ model: "mock:test", title: "Main" });
        const appended = await ctx.fns.session.appendUserMessage({ id: parent.id, text: "Хочу сделать goal-aware agent" });
        await ctx.fns.session.syncAgentState({ agent: parent });
        ctx.state.registry.llm.call = async () => ({
            text: JSON.stringify({ goals: [{ id: "goal-aware", statement: "Сделать агента goal-aware", verification: "После нового сообщения агент сохраняет цель и показывает проверяемый критерий в Observed goals", status: "active", sourceMessageIdx: appended.idx }] }),
            finishReason: "stop", usage: null, raw: null,
        });

        const result = await ctx.fns.agent.updateGoalSidecar({ agent: parent, messageIdx: appended.idx, userMessage: "Хочу сделать goal-aware agent" });

        expect(result.goals).toEqual([{ id: "goal-aware", statement: "Сделать агента goal-aware", verification: "После нового сообщения агент сохраняет цель и показывает проверяемый критерий в Observed goals", status: "active", sourceMessageIdx: appended.idx }]);
        expect(parent.scratchpad.goalSidecar.goals).toEqual(result.goals);
        expect(parent.goal).toBeNull();
        const row = ((await ctx.fns.procs.db.select({ sql: "SELECT parent_id, visibility, archived_at FROM agents WHERE id = ?", params: [result.sidecarId] })) as any[])[0];
        expect(row.parent_id).toBe(parent.id);
        expect(row.visibility).toBe("hidden");
        expect(row.archived_at).toBeTruthy();
    });
});
