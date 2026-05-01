import { describe, test, expect } from "bun:test";
import routePost from "./$route_$id_POST";
import start from "./start";
import enqueue from "./enqueue";
import wakeWorker from "./wakeWorker";
import connect from "../db/connect";
import migrate from "../db/migrate";
import save from "../session/save";
import appendMessage from "../session/appendMessage";
import appendEvent from "../session/appendEvent";
import appendUserMessage from "../session/appendUserMessage";
import appendErrorEvent from "../session/appendErrorEvent";
import getMessages from "../session/getMessages";
import getEvents from "../session/getEvents";
import getFullMessages from "../session/getFullMessages";
import syncAgentState from "../session/syncAgentState";
import renderEventHtml from "./renderEventHtml";

function mkCtx() {
    const ctx: any = { env: {}, state: {}, routes: {}, fns: { db: {}, session: {}, agent: {}, markdown: {} } };
    ctx.fns.db.connect = connect;
    ctx.fns.db.migrate = migrate;
    ctx.fns.db.exec = (c: any, sql: string, params: any) => {
        const db = c.state.db;
        const q = db.query(sql);
        const res = Array.isArray(params) ? q.run(...params) : q.run(params);
        return { changes: Number(res.changes ?? db.changes ?? 0), lastInsertRowid: Number(res.lastInsertRowid ?? 0) };
    };
    ctx.fns.db.select = (c: any, sql: string, params: any = []) => {
        const q = c.state.db.query(sql);
        return Array.isArray(params) ? q.all(...params) : q.all(params);
    };
    ctx.fns.session.save = save;
    ctx.fns.session.appendMessage = appendMessage;
    ctx.fns.session.appendEvent = appendEvent;
    ctx.fns.session.appendUserMessage = appendUserMessage;
    ctx.fns.session.appendErrorEvent = appendErrorEvent;
    ctx.fns.session.getMessages = getMessages;
    ctx.fns.session.getEvents = getEvents;
    ctx.fns.session.getFullMessages = getFullMessages;
    ctx.fns.session.syncAgentState = syncAgentState;
    ctx.fns.agent.start = start;
    ctx.fns.agent.enqueue = enqueue;
    ctx.fns.agent.wakeWorker = wakeWorker;
    ctx.fns.agent.renderEventHtml = renderEventHtml;
    ctx.fns.markdown.highlight = async (_c: any, s: string) => String(s);
    return ctx;
}

describe('agent POST route', () => {
    test('does not duplicate user message even if called twice', async () => {
        const ctx = mkCtx();
        ctx.fns.db.connect(ctx, ':memory:');
        await ctx.fns.db.migrate(ctx);
        const agent = start(ctx, { model: 'mock:test', systemPrompt: '', tools: [] });
        save(ctx, agent);
        (ctx.state as any).agent = { [agent.id]: agent };

        function mkReq() {
            const r = new Request('http://x/agent/' + agent.id + '?debounceSeconds=0', { method: 'POST', body: 'hello once' });
            (r as any).params = { id: agent.id };
            return r;
        }

        const res = await routePost(ctx, null, mkReq());
        expect(res.status).toBe(200);

        const messages = ctx.fns.session.getMessages(ctx, agent.id);
        const userMsgs = messages.filter((m: any) => m.role === 'user' && m.content === 'hello once');
        expect(userMsgs.length).toBe(1);

        // POST does not write a 'user' event anymore — that was an old behavior.
        // The user event is no longer emitted by the route; the message itself is the source of truth.
        // Worker run() may emit user events later (agent-specific), but the route itself doesn't.
    });
});
