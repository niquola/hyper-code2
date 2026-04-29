import { test, expect, describe } from "bun:test";
import evalFn from "./eval";

describe("repl.eval", () => {
    const ctx = { foo: "bar" } as unknown as Context;

    test("expression", async () => {
        expect(await evalFn(ctx, "1 + 1")).toBe(2);
    });

    test("async expression", async () => {
        expect(await evalFn(ctx, "Promise.resolve(42)")).toBe(42);
    });

    test("ctx is bound", async () => {
        expect(await evalFn(ctx, "ctx.foo")).toBe("bar");
    });

    test("statement block falls back", async () => {
        expect(await evalFn(ctx, "const x = 5; return x * 2;")).toBe(10);
    });

    test("throws on reference error", async () => {
        await expect(evalFn(ctx, "nonExistent.boom()")).rejects.toThrow(/not defined/);
    });

    test("no shortcut bindings — only ctx by default", async () => {
        await expect(evalFn(ctx, "repl")).rejects.toThrow(/repl is not defined/);
    });

    test("extra bindings are exposed by name", async () => {
        const agent = { id: "a1", messages: [] };
        const result = await evalFn(ctx, "agent.id", { agent });
        expect(result).toBe("a1");
    });

    test("bindings can be mutated", async () => {
        const agent = { messages: [] as any[] };
        await evalFn(ctx, "agent.messages.push({role:'user', content:'x'}); return agent.messages.length;", { agent });
        expect(agent.messages.length).toBe(1);
    });
});


import connect from "../db/connect";
import migrate from "../db/migrate";
import save from "../session/save";
import appendMessage from "../session/appendMessage";
import getMessages from "../session/getMessages";
import syncAgentState from "../session/syncAgentState";

describe("repl.eval with db-first agent sync", () => {
    test("tool code sees synced fork transcript via agent.messages", async () => {
        const ctx: any = { state: {}, env: {}, fns: { db: {}, session: {}, repl: { eval: evalFn } } };
        ctx.fns.db.connect = connect;
        ctx.fns.db.migrate = migrate;
        ctx.fns.db.exec = (c: any, sql: string, params: any) => { const q = c.state.db.query(sql); const res = Array.isArray(params) ? q.run(...params) : q.run(params); return { changes: c.state.db.changes, lastInsertRowid: Number(res.lastInsertRowid ?? 0) }; };
        ctx.fns.db.select = (c: any, sql: string, params: any = []) => { const q = c.state.db.query(sql); return Array.isArray(params) ? q.all(...params) : q.all(params); };
        ctx.fns.session.save = save;
        ctx.fns.session.appendMessage = appendMessage;
        ctx.fns.session.getMessages = getMessages;
        ctx.fns.session.getEvents = () => [];
        ctx.fns.session.getFullMessages = (c: any, id: string) => {
            const row = c.fns.db.select(c, 'SELECT parent_id, fork_offset FROM agents WHERE id = ?', [id])[0];
            const own = c.fns.session.getMessages(c, id);
            if (!row?.parent_id) return own;
            const parent = c.fns.session.getFullMessages(c, row.parent_id);
            return [...parent.slice(0, row.fork_offset ?? parent.length), ...own];
        };
        ctx.fns.session.syncAgentState = syncAgentState;
        ctx.fns.db.connect(ctx, ':memory:');
        await ctx.fns.db.migrate(ctx);

        const parent: any = { id: 'p1', model: 'm', systemPrompt: '', tools: [], scratchpad: {}, messages: [], events: [], cursors: {}, subscribers: new Set(), waiters: [], isStreaming: false, abortController: null, parentId: null, forkOffset: null };
        save(ctx, parent);
        appendMessage(ctx, 'p1', { role: 'user', content: 'parent hello' });

        const child: any = { id: 'c1', model: 'm', systemPrompt: '', tools: [], scratchpad: {}, messages: [], events: [], cursors: {}, subscribers: new Set(), waiters: [], isStreaming: false, abortController: null, parentId: 'p1', forkOffset: 1 };
        save(ctx, child);
        syncAgentState(ctx, child);

        const len = await evalFn(ctx, 'agent.messages.length', { agent: child });
        const first = await evalFn(ctx, 'agent.messages[0].content', { agent: child });
        expect(len).toBe(1);
        expect(first).toBe('parent hello');
    });
});
