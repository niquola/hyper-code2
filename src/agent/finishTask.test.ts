import { describe, test, expect } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";
import finishTask from "./finishTask";

async function setup() {
    const ctx = await mkTestCtx();
    ctx.fns.agent.finishTask = finishTask;
    return ctx;
}

describe("agent.finishTask", () => {
    test("child with task metadata can finish successfully", async () => {
        const ctx = await setup();
        const agent = await ctx.fns.agent.start({ model: "m", systemPrompt: "" });
        agent.scratchpad.delegateTask = { parentId: "parent1", mode: "await", status: "running" };
        await ctx.fns.session.save({ agent });
        const res = await finishTask(ctx, null, { agent, summary: "done", result: { value: 1 } });
        expect(res).toMatchObject({ ok: true, parentId: "parent1", summary: "done" });
    });

    test("result saved into scratchpad metadata", async () => {
        const ctx = await setup();
        const agent = await ctx.fns.agent.start({ model: "m", systemPrompt: "" });
        agent.scratchpad.delegateTask = { parentId: "parent1", mode: "await", status: "running" };
        await ctx.fns.session.save({ agent });
        await finishTask(ctx, null, { agent, summary: "done", result: { value: 2 } });
        const loaded = (await ctx.fns.session.load({ id: agent.id }))!;
        expect(loaded.scratchpad.delegateTask.status).toBe("finished");
        expect(loaded.scratchpad.delegateTask.result.summary).toBe("done");
        expect(loaded.scratchpad.delegateTask.result.result).toEqual({ value: 2 });
    });

    test("waiter resolves in await mode", async () => {
        const ctx = await setup();
        const agent = await ctx.fns.agent.start({ model: "m", systemPrompt: "" });
        agent.scratchpad.delegateTask = { parentId: "parent1", mode: "await", status: "running" };
        await ctx.fns.session.save({ agent });
        let resolved: any = null;
        ctx.state.delegateTaskWaiters = new Map([[agent.id, { resolve: (v: any) => { resolved = v; } }]]);
        const res = await finishTask(ctx, null, { agent, summary: "done", result: { value: 3 } });
        expect(res.waiterFound).toBe(true);
        expect(resolved).toEqual({ childId: agent.id, summary: "done", result: { value: 3 } });
    });

    test("missing delegation metadata throws", async () => {
        const ctx = await setup();
        const agent = await ctx.fns.agent.start({ model: "m", systemPrompt: "" });
        await ctx.fns.session.save({ agent });
        await expect(finishTask(ctx, null, { agent, summary: "done" })).rejects.toThrow("finishTask: missing delegation metadata");
    });

    test("async mode does not resolve waiter", async () => {
        const ctx = await setup();
        const agent = await ctx.fns.agent.start({ model: "m", systemPrompt: "" });
        agent.scratchpad.delegateTask = { parentId: "parent1", mode: "async", status: "running" };
        await ctx.fns.session.save({ agent });
        let resolved: any = null;
        ctx.state.delegateTaskWaiters = new Map([[agent.id, { resolve: (v: any) => { resolved = v; } }]]);
        const res = await finishTask(ctx, null, { agent, summary: "done", result: { value: 4 } });
        expect(res.waiterFound).toBe(false);
        expect(resolved).toBeNull();
    });

    test("summary required", async () => {
        const ctx = await setup();
        const agent = await ctx.fns.agent.start({ model: "m", systemPrompt: "" });
        agent.scratchpad.delegateTask = { parentId: "parent1", mode: "await", status: "running" };
        await ctx.fns.session.save({ agent });
        await expect(finishTask(ctx, null, { agent, summary: "   " })).rejects.toThrow("finishTask: summary is required");
    });
});
