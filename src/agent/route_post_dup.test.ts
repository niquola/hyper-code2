import { describe, test, expect } from "bun:test";
import routePost from "./$route_$id_POST";
import start from "./start";
import connect from "../db/connect";
import migrate from "../db/migrate";
import save from "../session/save";
import appendMessage from "../session/appendMessage";
import appendEvent from "../session/appendEvent";
import getMessages from "../session/getMessages";
import getEvents from "../session/getEvents";
import getFullMessages from "../session/getFullMessages";
import syncAgentState from "../session/syncAgentState";

function mkCtx() {
    const ctx: any = { env: {}, state: {}, routes: {}, fns: { db: {}, session: {}, agent: {} } };
    ctx.fns.db.connect = connect;
    ctx.fns.db.migrate = migrate;
    ctx.fns.db.exec = (c: any, sql: string, params: any) => {
        const db = c.state.db;
        const q = db.query(sql);
        const res = Array.isArray(params) ? q.run(...params) : q.run(params);
        return { changes: db.changes, lastInsertRowid: Number(res.lastInsertRowid ?? 0) };
    };
    ctx.fns.db.select = (c: any, sql: string, params: any = []) => {
        const q = c.state.db.query(sql);
        return Array.isArray(params) ? q.all(...params) : q.all(params);
    };
    ctx.fns.session.save = save;
    ctx.fns.session.appendMessage = appendMessage;
    ctx.fns.session.appendEvent = appendEvent;
    ctx.fns.session.getMessages = getMessages;
    ctx.fns.session.getEvents = getEvents;
    ctx.fns.session.getFullMessages = getFullMessages;
    ctx.fns.session.syncAgentState = syncAgentState;
    ctx.fns.agent.start = start;
    ctx.fns.agent.run = async (c: any, agent: any, text: string) => {
        c.fns.session.appendMessage(c, agent.id, { role: 'user', content: text });
        c.fns.session.appendEvent(c, agent.id, { type: 'user', text, messageIdx: 0 });
        c.fns.session.syncAgentState(c, agent);
        return { text: 'ok' };
    };
    return ctx;
}

describe('agent POST route', () => {
    test('does not create duplicate user events/messages before run persists turn', async () => {
        const ctx = mkCtx();
        ctx.fns.db.connect(ctx, ':memory:');
        await ctx.fns.db.migrate(ctx);
        const agent = start(ctx, { model: 'mock:test', systemPrompt: '', tools: [] });
        save(ctx, agent);

        const req: any = {
            params: { id: agent.id },
            text: async () => 'hello once',
        };

        const res = await routePost(ctx, null, req);
        expect(res.status).toBe(200);
        await new Promise(r => setTimeout(r, 0));
        await new Promise(r => setTimeout(r, 0));

        const messages = ctx.fns.session.getMessages(ctx, agent.id);
        const events = ctx.fns.session.getEvents(ctx, agent.id);
        expect(messages.filter((m: any) => m.role === 'user' && m.content === 'hello once')).toHaveLength(1);
        expect(events.filter((e: any) => e.type === 'user' && e.text === 'hello once')).toHaveLength(1);
    });
});
