import { describe, test, expect } from "bun:test";
import connect from "../db/connect";
import migrate from "../db/migrate";
import save from "../session/save";
import load from "../session/load";
import syncAgentState from "../session/syncAgentState";
import updateScratchpad from "../session/updateScratchpad";
import getMessages from "../session/getMessages";
import getEvents from "../session/getEvents";
import appendMessage from "../session/appendMessage";
import appendEvent from "../session/appendEvent";
import start from "./start";
import finishTask from "./finishTask";

function mkCtx() {
    const ctx: any = { env: {}, state: {}, fns: { db: {}, session: {}, agent: {} } };
    ctx.fns.db.connect = connect;
    ctx.fns.db.migrate = migrate;
    ctx.fns.db.exec = (c: any, sql: string, params: any) => { const q = c.state.db.query(sql); const res = Array.isArray(params) ? q.run(...params) : q.run(params); return { changes: c.state.db.changes, lastInsertRowid: Number(res.lastInsertRowid ?? 0) }; };
    ctx.fns.db.select = (c: any, sql: string, params: any = []) => { const q = c.state.db.query(sql); return Array.isArray(params) ? q.all(...params) : q.all(params); };
    ctx.fns.session.save = save;
    ctx.fns.session.appendMessage = appendMessage;
    ctx.fns.session.appendEvent = appendEvent;
    ctx.fns.session.load = load;
    ctx.fns.session.getMessages = getMessages;
    ctx.fns.session.getEvents = getEvents;
    ctx.fns.session.syncAgentState = syncAgentState;
    ctx.fns.session.updateScratchpad = updateScratchpad;
    ctx.fns.agent.finishTask = finishTask;
    return ctx;
}

describe("agent.finishTask", () => {
    test("child with task metadata can finish successfully", async () => {
        const ctx = mkCtx();
        ctx.fns.db.connect(ctx, ":memory:");
        await ctx.fns.db.migrate(ctx);
        const agent = start(ctx, { model: "m", systemPrompt: "", tools: [] });
        agent.scratchpad.delegateTask = { parentId: "parent1", mode: "await", status: "running" };
        save(ctx, agent);
        const res = finishTask(ctx, agent, { summary: "done", result: { value: 1 } });
        expect(res).toMatchObject({ ok: true, parentId: "parent1", summary: "done" });
    });

    test("result saved into scratchpad metadata", async () => {
        const ctx = mkCtx();
        ctx.fns.db.connect(ctx, ":memory:");
        await ctx.fns.db.migrate(ctx);
        const agent = start(ctx, { model: "m", systemPrompt: "", tools: [] });
        agent.scratchpad.delegateTask = { parentId: "parent1", mode: "await", status: "running" };
        save(ctx, agent);
        finishTask(ctx, agent, { summary: "done", result: { value: 2 } });
        const loaded = load(ctx, agent.id)!;
        expect(loaded.scratchpad.delegateTask.status).toBe("finished");
        expect(loaded.scratchpad.delegateTask.result.summary).toBe("done");
        expect(loaded.scratchpad.delegateTask.result.result).toEqual({ value: 2 });
    });

    test("waiter resolves in await mode", async () => {
        const ctx = mkCtx();
        ctx.fns.db.connect(ctx, ":memory:");
        await ctx.fns.db.migrate(ctx);
        const agent = start(ctx, { model: "m", systemPrompt: "", tools: [] });
        agent.scratchpad.delegateTask = { parentId: "parent1", mode: "await", status: "running" };
        save(ctx, agent);
        let resolved: any = null;
        ctx.state.delegateTaskWaiters = new Map([[agent.id, { resolve: (v: any) => { resolved = v; } }]]);
        const res = finishTask(ctx, agent, { summary: "done", result: { value: 3 } });
        expect(res.waiterFound).toBe(true);
        expect(resolved).toEqual({ childId: agent.id, summary: "done", result: { value: 3 } });
    });

    test("missing delegateTask metadata throws", async () => {
        const ctx = mkCtx();
        ctx.fns.db.connect(ctx, ":memory:");
        await ctx.fns.db.migrate(ctx);
        const agent = start(ctx, { model: "m", systemPrompt: "", tools: [] });
        save(ctx, agent);
        expect(() => finishTask(ctx, agent, { summary: "done" })).toThrow("finishTask: missing delegateTask metadata");
    });

    test("async mode does not resolve waiter", async () => {
        const ctx = mkCtx();
        ctx.fns.db.connect(ctx, ":memory:");
        await ctx.fns.db.migrate(ctx);
        const agent = start(ctx, { model: "m", systemPrompt: "", tools: [] });
        agent.scratchpad.delegateTask = { parentId: "parent1", mode: "async", status: "running" };
        save(ctx, agent);
        let resolved: any = null;
        ctx.state.delegateTaskWaiters = new Map([[agent.id, { resolve: (v: any) => { resolved = v; } }]]);
        const res = finishTask(ctx, agent, { summary: "done", result: { value: 4 } });
        expect(res.waiterFound).toBe(false);
        expect(resolved).toBeNull();
    });

    test("summary required", async () => {
        const ctx = mkCtx();
        ctx.fns.db.connect(ctx, ":memory:");
        await ctx.fns.db.migrate(ctx);
        const agent = start(ctx, { model: "m", systemPrompt: "", tools: [] });
        agent.scratchpad.delegateTask = { parentId: "parent1", mode: "await", status: "running" };
        save(ctx, agent);
        expect(() => finishTask(ctx, agent, { summary: "   " })).toThrow("finishTask: summary is required");
    });
});
