import { describe, expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

// The sidecar is a hidden full-transcript fork driven by agent.run; its
// answer is a single eval tool call to agent.setObservedGoals. Tests drive the
// mock provider through agent.scratchpad.mockLLM on the fork by hooking
// session.fork, so the parent's scratchpad stays clean. mkTestCtx stubs
// repl.eval to a constant, so the stub here performs the one call the sidecar
// is supposed to make, with the sidecar's own session (as the real eval would).
function mockSidecarModel(ctx: any, turns: any[]) {
    ctx.state.registry.repl.eval = async (c: any, _s: any, o: { code: string; agent?: any }) => {
        const m = /setObservedGoals\(\{ goals: (\[.*\]) \}\)/s.exec(o.code);
        if (!m) return "ok";
        const sctx: any = Object.create(c); sctx.session = ctx.fns.session.forAgent({ agent: o.agent });
        await sctx.fns.agent.setObservedGoals({ goals: JSON.parse(m[1]!) });
        return "ok";
    };
    const fork = ctx.state.registry.session.fork;
    ctx.state.registry.session.fork = async (c: any, s: any, opts: any) => {
        const child = await fork(c, s, opts);
        child.scratchpad = { ...(child.scratchpad ?? {}), mockLLM: { turns, defaultText: "done" } };
        const save = ctx.state.registry.session.save;
        // updateGoalSidecar replaces sidecar.scratchpad right after forking;
        // re-attach the mock on that first save so the run still sees it.
        ctx.state.registry.session.save = async (c2: any, s2: any, o: any) => {
            if (o.agent?.id === child.id && !o.agent.scratchpad?.mockLLM) o.agent.scratchpad = { ...(o.agent.scratchpad ?? {}), mockLLM: { turns, defaultText: "done" } };
            return save(c2, s2, o);
        };
        return child;
    };
}

describe("agent.updateGoalSidecar", () => {
    test("forks a hidden observer that reports goals through agent.setObservedGoals", async () => {
        const ctx: any = await mkTestCtx();
        const parent = await ctx.fns.agent.start({ model: "mock:test", title: "Main" });
        const appended = await ctx.fns.session.appendUserMessage({ id: parent.id, text: "Хочу сделать goal-aware agent" });
        await ctx.fns.session.syncAgentState({ agent: parent });
        const goals = [{ id: "goal-aware", statement: "Сделать агента goal-aware", verification: "После нового сообщения агент сохраняет цель и показывает проверяемый критерий в Observed goals", status: "active", sourceMessageIdx: appended.idx }];
        mockSidecarModel(ctx, [
            { toolCalls: [{ name: "eval", args: { code: `await ctx.fns.agent.setObservedGoals({ goals: ${JSON.stringify(goals)} })` } }] },
            { text: "done" },
        ]);

        const result = await ctx.fns.agent.updateGoalSidecar({ agent: parent, messageIdx: appended.idx, userMessage: "Хочу сделать goal-aware agent" });

        expect(result.goals).toEqual(goals);
        expect(parent.scratchpad.goalSidecar.goals).toEqual(goals);
        expect(parent.scratchpad.goalSidecar.status).toBe("ready");
        expect(parent.scratchpad.goalSidecar.sidecarId).toBe(result.sidecarId);
        expect(parent.goal).toBeNull();
        // The parent transcript is untouched: only the original user message.
        const parentRows = await ctx.fns.session.getMessages({ id: parent.id, includeExcluded: true });
        expect(parentRows.filter((m: any) => m.role === "user" && m.message_type !== "status_line").length).toBe(1);
        const row = ((await ctx.fns.procs.db.select({ sql: "SELECT parent_id, visibility, archived_at, fork_offset FROM agents WHERE id = ?", params: [result.sidecarId] })) as any[])[0];
        expect(row.parent_id).toBe(parent.id);
        expect(row.visibility).toBe("hidden");
        expect(row.archived_at).toBeTruthy();
        expect(Number(row.fork_offset)).toBeGreaterThan(0);
    });

    test("marks an error and keeps the previous preview when the sidecar answers in prose", async () => {
        const ctx: any = await mkTestCtx();
        const parent = await ctx.fns.agent.start({ model: "mock:test", title: "Main" });
        const first = await ctx.fns.session.appendUserMessage({ id: parent.id, text: "первое" });
        await ctx.fns.session.syncAgentState({ agent: parent });
        parent.scratchpad.goalSidecar = { goals: [{ id: "old", statement: "Старая цель", verification: "x", status: "active", sourceMessageIdx: first.idx }], status: "ready", sourceMessageIdx: first.idx, sidecarId: "zz" };
        await ctx.fns.session.save({ agent: parent });
        const appended = await ctx.fns.session.appendUserMessage({ id: parent.id, text: "и ещё кое-что" });
        expect(appended.idx).toBeGreaterThan(first.idx);
        await ctx.fns.session.syncAgentState({ agent: parent });
        mockSidecarModel(ctx, [{ text: '{"goals":[]}' }]);

        const result = await ctx.fns.agent.updateGoalSidecar({ agent: parent, messageIdx: appended.idx, userMessage: "и ещё кое-что" });

        expect(result.goals.map((g: any) => g.id)).toEqual(["old"]);
        expect(parent.scratchpad.goalSidecar.status).toBe("error");
        expect(parent.scratchpad.goalSidecar.error).toContain("setObservedGoals");
        const row = ((await ctx.fns.procs.db.select({ sql: "SELECT archived_at FROM agents WHERE id = ?", params: [result.sidecarId] })) as any[])[0];
        expect(row.archived_at).toBeTruthy();
    });

    test("setObservedGoals refuses a stale writer for an older message", async () => {
        const ctx: any = await mkTestCtx();
        const parent = await ctx.fns.agent.start({ model: "mock:test", title: "Main" });
        parent.scratchpad.goalSidecar = { goals: [{ id: "new", statement: "Новая", verification: "x", status: "active", sourceMessageIdx: 5 }], status: "ready", sourceMessageIdx: 5 };
        await ctx.fns.session.save({ agent: parent });
        const stale = await ctx.fns.session.fork({ id: parent.id, visibility: "hidden" });
        stale.scratchpad = { goalSidecarFor: parent.id, sourceMessageIdx: 2 };
        await ctx.fns.session.save({ agent: stale });
        const session = ctx.fns.session.forAgent({ agent: stale });
        const sctx: any = Object.create(ctx); sctx.session = session;
        await sctx.fns.agent.setObservedGoals({ goals: [{ statement: "Устаревшая" }] });
        const fresh = await ctx.fns.session.load({ id: parent.id });
        expect(fresh.scratchpad.goalSidecar.goals.map((g: any) => g.id)).toEqual(["new"]);
    });

    test("setObservedGoals refuses callers that are not a goal sidecar of the parent", async () => {
        const ctx: any = await mkTestCtx();
        const parent = await ctx.fns.agent.start({ model: "mock:test", title: "Main" });
        const other = await ctx.fns.session.fork({ id: parent.id, visibility: "hidden" });
        const sctx: any = Object.create(ctx); sctx.session = ctx.fns.session.forAgent({ agent: other });
        await expect(sctx.fns.agent.setObservedGoals({ goals: [{ statement: "X" }] })).rejects.toThrow(/own parent/);
        const pctx: any = Object.create(ctx); pctx.session = ctx.fns.session.forAgent({ agent: parent });
        await expect(pctx.fns.agent.setObservedGoals({ goals: [{ statement: "X" }] })).rejects.toThrow(/own parent/);
    });

    test("a ready result written by this sidecar survives a failing follow-up turn", async () => {
        const ctx: any = await mkTestCtx();
        const parent = await ctx.fns.agent.start({ model: "mock:test", title: "Main" });
        const appended = await ctx.fns.session.appendUserMessage({ id: parent.id, text: "цель" });
        await ctx.fns.session.syncAgentState({ agent: parent });
        const goals = [{ id: "g", statement: "Цель", verification: "v", status: "active", sourceMessageIdx: appended.idx }];
        mockSidecarModel(ctx, [{ toolCalls: [{ name: "eval", args: { code: `await ctx.fns.agent.setObservedGoals({ goals: ${JSON.stringify(goals)} })` } }] }]);
        // The second provider turn (after the tool result) blows up.
        const stream = ctx.state.registry.llm.stream; let calls = 0;
        ctx.state.registry.llm.stream = async (c: any, s: any, o: any) => { if (++calls === 2) throw new Error("provider down"); return stream(c, s, o); };
        const result = await ctx.fns.agent.updateGoalSidecar({ agent: parent, messageIdx: appended.idx, userMessage: "цель" });
        expect(result.goals).toEqual(goals);
        expect(parent.scratchpad.goalSidecar.status).toBe("ready");
        expect(parent.scratchpad.goalSidecar.error).toBeUndefined();
    });
});
