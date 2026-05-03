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
    ctx.fns.agent.run = async (c: any, opts: { agent: any; userText: string }) => {
        const child = opts.agent;
        child.scratchpad.__lastPrompt = opts.userText;
        return c.fns.agent.finishTask(c, { agent: child, summary: "done", result: { ok: true, inherited: !!child.parentId } });
    };
    return ctx;
}

describe("agent.delegateTask", () => {
    test("forkContext true links child to parent transcript context", async () => {
        const ctx = await setup();
        const parent = ctx.fns.agent.start(ctx, { model: "m", systemPrompt: "sp" });
        ctx.fns.session.save(ctx, { agent: parent });
        ctx.fns.session.appendMessage(ctx, { id: parent.id, message: { role: "user", content: "parent msg" } });
        const res = await delegateTask(ctx, { parent, task: "check", forkContext: true, responseFormat: "json" });
        const child = ctx.state.agent[res.childId];
        expect(child.parentId).toBe(parent.id);
        expect(ctx.fns.session.getFullMessages(ctx, { id: child.id })[0].content).toBe("parent msg");
    });

    test("forkContext false creates isolated child", async () => {
        const ctx = await setup();
        const parent = ctx.fns.agent.start(ctx, { model: "m", systemPrompt: "sp" });
        ctx.fns.session.save(ctx, { agent: parent });
        ctx.fns.session.appendMessage(ctx, { id: parent.id, message: { role: "user", content: "parent msg" } });
        const res = await delegateTask(ctx, { parent, task: "check", forkContext: false });
        const child = ctx.state.agent[res.childId];
        expect(child.parentId).toBeNull();
        expect(ctx.fns.session.getFullMessages(ctx, { id: child.id }).map((m: any) => m.content)).not.toContain("parent msg");
        expect(child.scratchpad.delegateTask.parentId).toBe(parent.id);
    });

    test("await mode returns childId summary and result", async () => {
        const ctx = await setup();
        const parent = ctx.fns.agent.start(ctx, { model: "m", systemPrompt: "sp" });
        ctx.fns.session.save(ctx, { agent: parent });
        const res = await delegateTask(ctx, { parent, task: "do it", responseFormat: "json" });
        expect(res).toEqual({ childId: res.childId, summary: "done", result: { ok: true, inherited: false } });
    });

    test("stores task metadata in child scratchpad", async () => {
        const ctx = await setup();
        const parent = ctx.fns.agent.start(ctx, { model: "m", systemPrompt: "sp" });
        ctx.fns.session.save(ctx, { agent: parent });
        const res = await delegateTask(ctx, { parent, task: "lint files", instructions: "be strict", responseFormat: { kind: "report", fields: ["files", "issues"] } });
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
        const parent = ctx.fns.agent.start(ctx, { model: "m", systemPrompt: "sp" });
        ctx.fns.session.save(ctx, { agent: parent });
        ctx.fns.agent.run = async () => ({ ok: true });
        await expect(delegateTask(ctx, { parent, task: "bad child" })).rejects.toThrow("delegateTask: child completed without finishTask");
    });

    test("builds wrapped delegated prompt", async () => {
        const ctx = await setup();
        const parent = ctx.fns.agent.start(ctx, { model: "m", systemPrompt: "sp" });
        ctx.fns.session.save(ctx, { agent: parent });
        const res = await delegateTask(ctx, { parent, task: "inspect repo", instructions: "only source files", responseFormat: "report" });
        const child = ctx.state.agent[res.childId];
        expect(child.scratchpad.__lastPrompt).toContain("You are executing a delegated task for a parent agent.");
        expect(child.scratchpad.__lastPrompt).toContain("inspect repo");
        expect(child.scratchpad.__lastPrompt).toContain("only source files");
        expect(child.scratchpad.__lastPrompt).toContain("finishTask");
    });
});
