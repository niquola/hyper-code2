import { describe, test, expect } from "bun:test";
import connect from "../db/connect";
import migrate from "../db/migrate";
import save from "../session/save";
import load from "../session/load";
import getMessages from "../session/getMessages";
import getFullMessages from "../session/getFullMessages";
import syncAgentState from "../session/syncAgentState";
import updateScratchpad from "../session/updateScratchpad";
import appendMessage from "../session/appendMessage";
import appendEvent from "../session/appendEvent";
import getEvents from "../session/getEvents";
import fork from "../session/fork";
import start from "./start";
import delegateTask from "./delegateTask";
import finishTask from "./finishTask";
import buildDelegatedTaskPrompt from "./buildDelegatedTaskPrompt";

function mkCtx() {
    const ctx: any = { env: {}, state: {}, fns: { db: {}, session: {}, agent: {}, events: {} } };
    ctx.fns.db.connect = connect;
    ctx.fns.db.migrate = migrate;
    ctx.fns.db.exec = (c: any, sql: string, params: any) => { const q = c.state.db.query(sql); const res = Array.isArray(params) ? q.run(...params) : q.run(params); return { changes: c.state.db.changes, lastInsertRowid: Number(res.lastInsertRowid ?? 0) }; };
    ctx.fns.db.select = (c: any, sql: string, params: any = []) => { const q = c.state.db.query(sql); return Array.isArray(params) ? q.all(...params) : q.all(params); };
    ctx.fns.session.save = save;
    ctx.fns.session.load = load;
    ctx.fns.session.getMessages = getMessages;
    ctx.fns.session.getFullMessages = getFullMessages;
    ctx.fns.session.syncAgentState = syncAgentState;
    ctx.fns.session.updateScratchpad = updateScratchpad;
    ctx.fns.session.appendMessage = appendMessage;
    ctx.fns.session.appendEvent = appendEvent;
    ctx.fns.session.getEvents = getEvents;
    ctx.fns.session.fork = fork;
    ctx.fns.agent.start = start;
    ctx.fns.agent.delegateTask = delegateTask;
    ctx.fns.agent.finishTask = finishTask;
    ctx.fns.agent.buildDelegatedTaskPrompt = buildDelegatedTaskPrompt;
    ctx.fns.agent.run = async (c: any, child: any, prompt: string) => {
        child.scratchpad.__lastPrompt = prompt;
        return c.fns.agent.finishTask(c, child, { summary: "done", result: { ok: true, inherited: !!child.parentId } });
    };
    ctx.fns.agent.renderEventHtml = async () => "";
    ctx.fns.events.emitAgentsChanged = () => {};
    return ctx;
}

describe("agent.delegateTask", () => {
    test("forkContext true links child to parent transcript context", async () => {
        const ctx = mkCtx();
        ctx.fns.db.connect(ctx, ":memory:");
        await ctx.fns.db.migrate(ctx);
        const parent = start(ctx, { model: "m", systemPrompt: "sp", tools: [] });
        save(ctx, parent);
        appendMessage(ctx, parent.id, { role: "user", content: "parent msg" });
        const res = await delegateTask(ctx, parent, { task: "check", forkContext: true, responseFormat: "json" });
        const child = ctx.state.agent[res.childId];
        expect(child.parentId).toBe(parent.id);
        expect(getFullMessages(ctx, child.id)[0].content).toBe("parent msg");
    });

    test("forkContext false creates isolated child", async () => {
        const ctx = mkCtx();
        ctx.fns.db.connect(ctx, ":memory:");
        await ctx.fns.db.migrate(ctx);
        const parent = start(ctx, { model: "m", systemPrompt: "sp", tools: [] });
        save(ctx, parent);
        appendMessage(ctx, parent.id, { role: "user", content: "parent msg" });
        const res = await delegateTask(ctx, parent, { task: "check", forkContext: false });
        const child = ctx.state.agent[res.childId];
        expect(child.parentId).toBeNull();
        expect(getFullMessages(ctx, child.id).map((m: any) => m.content)).not.toContain("parent msg");
        expect(child.scratchpad.delegateTask.parentId).toBe(parent.id);
    });

    test("await mode returns childId summary and result", async () => {
        const ctx = mkCtx();
        ctx.fns.db.connect(ctx, ":memory:");
        await ctx.fns.db.migrate(ctx);
        const parent = start(ctx, { model: "m", systemPrompt: "sp", tools: [] });
        save(ctx, parent);
        const res = await delegateTask(ctx, parent, { task: "do it", responseFormat: "json" });
        expect(res).toEqual({ childId: res.childId, summary: "done", result: { ok: true, inherited: false } });
    });

    test("stores task metadata in child scratchpad", async () => {
        const ctx = mkCtx();
        ctx.fns.db.connect(ctx, ":memory:");
        await ctx.fns.db.migrate(ctx);
        const parent = start(ctx, { model: "m", systemPrompt: "sp", tools: [] });
        save(ctx, parent);
        const res = await delegateTask(ctx, parent, { task: "lint files", instructions: "be strict", responseFormat: { kind: "report", fields: ["files", "issues"] } });
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
        const ctx = mkCtx();
        ctx.fns.db.connect(ctx, ":memory:");
        await ctx.fns.db.migrate(ctx);
        const parent = start(ctx, { model: "m", systemPrompt: "sp", tools: [] });
        save(ctx, parent);
        ctx.fns.agent.run = async () => ({ ok: true });
        await expect(delegateTask(ctx, parent, { task: "bad child" })).rejects.toThrow("delegateTask: child completed without finishTask");
    });

    test("builds wrapped delegated prompt", async () => {
        const ctx = mkCtx();
        ctx.fns.db.connect(ctx, ":memory:");
        await ctx.fns.db.migrate(ctx);
        const parent = start(ctx, { model: "m", systemPrompt: "sp", tools: [] });
        save(ctx, parent);
        const res = await delegateTask(ctx, parent, { task: "inspect repo", instructions: "only source files", responseFormat: "report" });
        const child = ctx.state.agent[res.childId];
        expect(child.scratchpad.__lastPrompt).toContain("You are executing a delegated task for a parent agent.");
        expect(child.scratchpad.__lastPrompt).toContain("inspect repo");
        expect(child.scratchpad.__lastPrompt).toContain("only source files");
        expect(child.scratchpad.__lastPrompt).toContain("finishTask");
    });
});
