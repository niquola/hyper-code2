import { describe, expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("session.updatePlan", () => {
    test("edits fields, adds, removes and reorders pending tasks while preserving state", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        await ctx.fns.session.plan({ agent, title: "Old", tasks: [
            { id: "a", title: "A" }, { id: "b", title: "B" }, { id: "c", title: "C" },
        ] });
        const startedAt = agent.scratchpad.plan.tasks[0].startedAt;
        const result = await ctx.fns.session.updatePlan({ agent, title: "New", tasks: [
            { id: "a", title: "A edited", instructions: "details" },
            { id: "d", title: "D" },
            { id: "b", title: "B edited" },
        ] });
        expect(result.plan.title).toBe("New");
        expect(result.plan.tasks.map((task: any) => task.id)).toEqual(["a", "d", "b"]);
        expect(result.plan.tasks[0]).toMatchObject({ status: "active", startedAt, title: "A edited", instructions: "details" });
        expect(result.plan.tasks[1]).toMatchObject({ status: "pending", elapsedMs: 0 });
    });

    test("activates the first added task when extending a completed plan", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        await ctx.fns.session.plan({ agent, tasks: [{ id: "a", title: "A" }] });
        await ctx.fns.session.done({ agent, id: "a" });
        const result = await ctx.fns.session.updatePlan({ agent, tasks: [
            { id: "a", title: "A" }, { id: "b", title: "B", instructions: "Do B" },
        ] });
        expect(result.plan.tasks[1]).toMatchObject({ id: "b", status: "active" });
        expect(result.plan.tasks[1].activeSince).toBeNumber();
    });


    test("rejects removal or reordering of active and done tasks", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        await ctx.fns.session.plan({ agent, tasks: [{ id: "a", title: "A" }, { id: "b", title: "B" }, { id: "c", title: "C" }] });
        await ctx.fns.session.done({ agent, id: "a" });
        expect(ctx.fns.session.updatePlan({ agent, tasks: [{ id: "b", title: "B" }, { id: "c", title: "C" }] })).rejects.toThrow("cannot be removed");
        expect(ctx.fns.session.updatePlan({ agent, tasks: [{ id: "b", title: "B" }, { id: "a", title: "A" }, { id: "c", title: "C" }] })).rejects.toThrow("cannot be reordered");
    });

    test("rejects duplicate IDs and new tasks before fixed history", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        await ctx.fns.session.plan({ agent, tasks: [{ id: "a", title: "A" }] });
        expect(ctx.fns.session.updatePlan({ agent, tasks: [{ id: "a", title: "A" }, { id: "a", title: "Again" }] })).rejects.toThrow("duplicate task id");
        expect(ctx.fns.session.updatePlan({ agent, tasks: [{ id: "new", title: "New" }, { id: "a", title: "A" }] })).rejects.toThrow("pending tasks must follow");
    });
});
