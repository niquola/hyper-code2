import { describe, test, expect } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";
import delegateTask from "./delegateTask";
import finishTask from "./finishTask";
import buildDelegatedTaskPrompt from "./buildDelegatedTaskPrompt";

async function setup() {
    const ctx = await mkTestCtx();
    ctx.fns.agent.delegateTask = delegateTask;
    ctx.fns.agent.finishTask = finishTask;
    ctx.fns.agent.buildDelegatedTaskPrompt = buildDelegatedTaskPrompt;
    ctx.fns.agent.run = async (c: any, _s: any, opts: { agent: any; userText: string }) => {
        const child = opts.agent;
        child.scratchpad.__lastPrompt = opts.userText;
        return c.fns.agent.finishTask({ agent: child, summary: "done", result: { ok: true, inherited: !!child.parentId } });
    };
    return ctx;
}

describe("agent.delegateTask", () => {
    test("forkContext true links child to parent transcript context", async () => {
        const ctx = await setup();
        const parent = await ctx.fns.agent.start({ model: "m", systemPrompt: "sp" });
        await ctx.fns.session.save({ agent: parent });
        await ctx.fns.session.appendMessage({ id: parent.id, message: { role: "user", content: "parent msg" } });
        const res = await delegateTask(ctx, null, { parent, task: "check", forkContext: true, responseFormat: "json", autoArchive: false });
        const child = ctx.state.agent[res.childId];
        expect(child.parentId).toBe(parent.id);
        expect((await ctx.fns.session.getFullMessages({ id: child.id }))[0].content).toBe("parent msg");
    });

    test("forkContext false creates isolated child", async () => {
        const ctx = await setup();
        const parent = await ctx.fns.agent.start({ model: "m", systemPrompt: "sp" });
        await ctx.fns.session.save({ agent: parent });
        await ctx.fns.session.appendMessage({ id: parent.id, message: { role: "user", content: "parent msg" } });
        const res = await delegateTask(ctx, null, { parent, task: "check", forkContext: false, autoArchive: false });
        const child = ctx.state.agent[res.childId];
        expect(child.parentId).toBeNull();
        expect((await ctx.fns.session.getFullMessages({ id: child.id })).map((m: any) => m.content)).not.toContain("parent msg");
        expect(child.scratchpad.delegateTask.parentId).toBe(parent.id);
    });

    test("await mode returns childId summary and result", async () => {
        const ctx = await setup();
        const parent = await ctx.fns.agent.start({ model: "m", systemPrompt: "sp" });
        await ctx.fns.session.save({ agent: parent });
        const res = await delegateTask(ctx, null, { parent, task: "do it", responseFormat: "json" });
        expect(res).toEqual({ childId: res.childId, summary: "done", result: { ok: true, inherited: false } });
    });

    test("stores task metadata in child scratchpad", async () => {
        const ctx = await setup();
        const parent = await ctx.fns.agent.start({ model: "m", systemPrompt: "sp" });
        await ctx.fns.session.save({ agent: parent });
        const res = await delegateTask(ctx, null, { parent, task: "lint files", instructions: "be strict", responseFormat: { kind: "report", fields: ["files", "issues"] }, autoArchive: false });
        const child = ctx.state.agent[res.childId];
        expect(child.scratchpad.delegateTask).toMatchObject({
            parentId: parent.id,
            mode: "await",
            forkContext: false,
            task: "lint files",
            instructions: "be strict",
            status: "finished",
        });
    });

    test("throws if child completes without finishTask", async () => {
        const ctx = await setup();
        const parent = await ctx.fns.agent.start({ model: "m", systemPrompt: "sp" });
        await ctx.fns.session.save({ agent: parent });
        ctx.fns.agent.run = async () => ({ ok: true });
        await expect(delegateTask(ctx, null, { parent, task: "bad child" })).rejects.toThrow("delegateTask: child completed without finishTask");
    });

    test("builds wrapped delegated prompt", async () => {
        const ctx = await setup();
        const parent = await ctx.fns.agent.start({ model: "m", systemPrompt: "sp" });
        await ctx.fns.session.save({ agent: parent });
        const res = await delegateTask(ctx, null, { parent, task: "inspect repo", instructions: "only source files", responseFormat: "report", autoArchive: false });
        const child = ctx.state.agent[res.childId];
        expect(child.scratchpad.__lastPrompt).toContain("You are executing a delegated task for a parent agent.");
        expect(child.scratchpad.__lastPrompt).toContain("inspect repo");
        expect(child.scratchpad.__lastPrompt).toContain("only source files");
        expect(child.scratchpad.__lastPrompt).toContain("finishTask");
    });
    test("archives a completed child by default", async () => {
        const ctx = await setup();
        const parent = await ctx.fns.agent.start({ model: "m", systemPrompt: "sp" });
        await ctx.fns.session.save({ agent: parent });
        const res = await delegateTask(ctx, null, { parent, task: "research", responseFormat: "json" });
        expect((await ctx.fns.session.list()).some((a: any) => a.id === res.childId)).toBe(false);
        expect((await ctx.fns.session.list({ includeArchived: true })).find((a: any) => a.id === res.childId)?.archivedAt).not.toBeNull();
    });
});
