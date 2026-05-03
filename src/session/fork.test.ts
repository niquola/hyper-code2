import { describe, test, expect } from "bun:test";
import connect from "../db/connect";
import migrate from "../db/migrate";
import save from "./save";
import appendUserMessage from "./appendUserMessage";
import appendAssistantMessage from "./appendAssistantMessage";
import appendEvent from "./appendEvent";
import appendMessage from "./appendMessage";
import load from "./load";
import fork from "./fork";
import getFullMessages from "./getFullMessages";
import getMessages from "./getMessages";
import start from "../agent/start";
import nextId from "../agent/nextId";

function mkCtx() {
  const ctx: any = { env: {}, state: {}, fns: { db: {}, session: {}, agent: {}, events: {} } };
  ctx.fns.db.connect = connect;
  ctx.fns.db.migrate = migrate;
  ctx.fns.db.exec = (c: any, opts: { sql: string; params?: any }) => { const params = opts.params ?? []; const q = c.state.db.query(opts.sql); const res = Array.isArray(params) ? q.run(...params) : q.run(params); return { changes: c.state.db.changes, lastInsertRowid: Number(res.lastInsertRowid ?? 0) }; };
  ctx.fns.db.select = (c: any, opts: { sql: string; params?: any }) => { const params = opts.params ?? []; const q = c.state.db.query(opts.sql); return Array.isArray(params) ? q.all(...params) : q.all(params); };
  ctx.fns.session.save = save;
  ctx.fns.session.load = load;
  ctx.fns.session.fork = fork;
  ctx.fns.session.getFullMessages = getFullMessages;
  ctx.fns.session.getMessages = getMessages;
  ctx.fns.session.appendMessage = appendMessage;
  ctx.fns.session.appendEvent = appendEvent;
  ctx.fns.session.appendUserMessage = appendUserMessage;
  ctx.fns.session.appendAssistantMessage = appendAssistantMessage;
  ctx.fns.agent.start = start;
  ctx.fns.agent.nextId = nextId;
  ctx.fns.agent.renderEventHtml = async () => '';
  ctx.fns.events.emitAgentsChanged = () => {};
  return ctx;
}

describe("session.fork", () => {
  test("creates child with parent link and full-context offset", async () => {
    const ctx: any = mkCtx();
    ctx.fns.db.connect(ctx, { path: ":memory:" });
    await ctx.fns.db.migrate(ctx);
    const parent = start(ctx, { model: "openai/gpt-4o", systemPrompt: "sp" });
    save(ctx, { agent: parent });
    await appendUserMessage(ctx, { id: parent.id, text: 'Hello' });
    appendAssistantMessage(ctx, { id: parent.id, msg: { content: 'Hi!' } });
    const child = fork(ctx, { id: parent.id });
    expect(child.parentId).toBe(parent.id);
    expect(child.forkOffset).toBe(2);
    expect(child.model).toBe("openai/gpt-4o");
  });

  test("nested fork uses full parent count, not own-only count", async () => {
    const ctx: any = mkCtx();
    ctx.fns.db.connect(ctx, { path: ":memory:" });
    await ctx.fns.db.migrate(ctx);
    const gp = start(ctx, { model: "m", systemPrompt: "" });
    save(ctx, { agent: gp });
    await appendUserMessage(ctx, { id: gp.id, text: 'gp msg' });
    const parent = fork(ctx, { id: gp.id });
    await appendUserMessage(ctx, { id: parent.id, text: 'parent msg' });
    const grandchild = fork(ctx, { id: parent.id });
    expect(ctx.fns.session.getFullMessages(ctx, { id: parent.id }).length).toBe(2);
    expect(grandchild.forkOffset).toBe(2);
  });
});
