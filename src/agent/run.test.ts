import { describe, test, expect } from "bun:test";
import run from "./run";
import start from "./start";
import connect from "../db/connect";
import migrate from "../db/migrate";
import save from "../session/save";
import load from "../session/load";
import appendMessage from "../session/appendMessage";
import appendEvent from "../session/appendEvent";
import getMessages from "../session/getMessages";
import getFullMessages from "../session/getFullMessages";
import getEvents from "../session/getEvents";
import stream from "../llm/stream";
import streamMock from "../llm/streamMock";
import resolveEndpoint from "../llm/resolveEndpoint";

const evalCodeTool = {
    name: "evalCode",
    description: "Execute a JavaScript expression or statements. Returns the serialized result.",
    parameters: {
        type: "object",
        properties: { code: { type: "string", description: "JS code to evaluate" } },
        required: ["code"],
    },
};

function mkCtx() {
    const ctx: any = { state: {}, env: {}, fns: { db: {}, session: {}, agent: {}, llm: {}, markdown: {}, repl: {}, events: {} } };
    ctx.fns.db.connect = connect;
    ctx.fns.db.migrate = migrate;
    ctx.fns.db.exec = (c: any, sql: string, params: any) => { const q = c.state.db.query(sql); const res = Array.isArray(params) ? q.run(...params) : q.run(params); return { changes: c.state.db.changes, lastInsertRowid: Number(res.lastInsertRowid ?? 0) }; };
    ctx.fns.db.select = (c: any, sql: string, params: any = []) => { const q = c.state.db.query(sql); return Array.isArray(params) ? q.all(...params) : q.all(params); };
    ctx.fns.session.save = save;
    ctx.fns.session.appendUserMessage = (c: any, id: string, text: string) => c.fns.session.appendMessage(c, id, { role: 'user', content: text });
    ctx.fns.session.appendAssistantMessage = (c: any, id: string, msg: any) => c.fns.session.appendMessage(c, id, { role: 'assistant', ...(msg.content ? { content: msg.content } : {}), ...(msg.tool_calls?.length ? { tool_calls: msg.tool_calls } : {}) });
    ctx.fns.session.appendToolMessage = (c: any, id: string, toolCallId: string, content: string) => c.fns.session.appendMessage(c, id, { role: 'tool', tool_call_id: toolCallId, content });
    ctx.fns.session.appendThinkingEvent = (c: any, id: string, text: string) => c.fns.session.appendEvent(c, id, { type: 'thinking', text });
    ctx.fns.session.appendAssistantEvent = (c: any, id: string, payload: any) => c.fns.session.appendEvent(c, id, { type: 'assistant', ...payload });
    ctx.fns.session.appendToolCallEvent = (c: any, id: string, payload: any) => c.fns.session.appendEvent(c, id, { type: 'tool_call', ...payload });
    ctx.fns.session.appendErrorEvent = (c: any, id: string, error: string) => c.fns.session.appendEvent(c, id, { type: 'error', error });
    ctx.fns.session.load = load;
    ctx.fns.session.appendMessage = appendMessage;
    ctx.fns.session.appendEvent = appendEvent;
    ctx.fns.session.getMessages = getMessages;
    ctx.fns.session.getFullMessages = getFullMessages;
    ctx.fns.session.getEvents = getEvents;
    ctx.fns.session.syncAgentState = (c: any, a: any) => { a.messages = a.parentId ? c.fns.session.getFullMessages(c, a.id) : c.fns.session.getMessages(c, a.id); a.events = c.fns.session.getEvents(c, a.id); return a; };
    ctx.fns.agent.start = start;
    ctx.fns.llm.stream = stream;
    ctx.fns.llm.streamMock = streamMock;
    ctx.fns.llm.resolveEndpoint = resolveEndpoint;
    ctx.fns.markdown.highlight = async (_c: any, s: any) => {
        return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    };
    ctx.fns.markdown.render = async (_c: any, s: string) => s;
    ctx.fns.repl.eval = async (_c: any, code: string) => { if (code === '2+2') return 4; return 'ok'; };
    ctx.fns.events.emitAgentsChanged = () => {};
    ctx.fns.events.emit = (_c: any, ev: any) => { (((_c.state as any).__emitted) ??= []).push(ev); };
    return ctx;
}

describe("agent.run with mock llm", () => {
    test("echoes a user message through mock provider", async () => {
        const ctx = mkCtx();
        ctx.fns.db.connect(ctx, ':memory:');
        await ctx.fns.db.migrate(ctx);
        const agent = start(ctx, { model: 'mock:echo', systemPrompt: '', tools: [] });
        agent.scratchpad.mockLLM = { echoUser: true };
        save(ctx, agent);
        const res = await run(ctx, agent, 'hello mock');
        expect(res.text).toBe('hello mock');
    });

    test("runs tool loop through mock provider", async () => {
        const ctx = mkCtx();
        ctx.fns.db.connect(ctx, ':memory:');
        await ctx.fns.db.migrate(ctx);
        const agent = start(ctx, { model: 'mock:tool', systemPrompt: '', tools: [evalCodeTool] });
        agent.scratchpad.mockLLM = { userToolCode: '2+2', afterToolText: '4' };
        save(ctx, agent);
        const res = await run(ctx, agent, 'calc');
        expect(res.text).toBe('4');
    });

    test("fork child sees inherited parent messages via mock provider", async () => {
        const ctx = mkCtx();
        ctx.fns.db.connect(ctx, ':memory:');
        await ctx.fns.db.migrate(ctx);
        const parent = start(ctx, { model: 'mock:echo', systemPrompt: '', tools: [] });
        save(ctx, parent);
        appendMessage(ctx, parent.id, { role: 'user', content: 'parent says hi' });
        const child = start(ctx, { model: 'mock:echo', systemPrompt: '', tools: [], parentId: parent.id, forkOffset: 1 });
        child.scratchpad.mockLLM = { echoUser: true };
        save(ctx, child);
        const full = getFullMessages(ctx, child.id);
        expect(full[0].content).toBe('parent says hi');
    });

    test("fails before tool messages are appended when one of multiple tool calls has missing code", async () => {
        const ctx = mkCtx();
        ctx.fns.db.connect(ctx, ':memory:');
        await ctx.fns.db.migrate(ctx);
        const agent = start(ctx, { model: 'mock:tool', systemPrompt: '', tools: [evalCodeTool] });
        save(ctx, agent);

        ctx.fns.llm.stream = async () => ({
            text: '',
            thinking: '',
            toolCalls: [
                { id: 'call_ok', name: 'evalCode', arguments: JSON.stringify({ code: '2+2' }) },
                { id: 'call_bad', name: 'evalCode', arguments: JSON.stringify({}) },
            ],
            usage: {},
        });

        await expect(run(ctx, agent, 'probe')).rejects.toThrow('Cannot read properties of undefined');

        const msgs = getMessages(ctx, agent.id);
        expect(msgs.at(-1)?.role).toBe('assistant');
        expect(msgs.at(-1)?.tool_calls?.map((tc: any) => tc.id)).toEqual(['call_ok', 'call_bad']);
        expect(msgs.filter((m: any) => m.role === 'tool')).toHaveLength(0);
    });
});
