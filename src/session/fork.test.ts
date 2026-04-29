import { describe, test, expect } from "bun:test";
import connect from "../db/connect";
import migrate from "../db/migrate";
import save from "./save";
import appendUserMessage from "./appendUserMessage";
import appendAssistantMessage from "./appendAssistantMessage";
import load from "./load";
import fork from "./fork";
import getFullMessages from "./getFullMessages";
import getMessages from "./getMessages";
import start from "../agent/start";

function mkCtx() {
  const ctx: any = { env: {}, state: {}, fns: { db: {}, session: {}, agent: {}, events: {} } };
  ctx.fns.db.connect = connect;
  ctx.fns.db.migrate = migrate;
  ctx.fns.db.exec = (c: any, sql: string, params: any) => { const q = c.state.db.query(sql); const res = Array.isArray(params) ? q.run(...params) : q.run(params); return { changes: c.state.db.changes, lastInsertRowid: Number(res.lastInsertRowid ?? 0) }; };
  ctx.fns.db.select = (c: any, sql: string, params: any = []) => { const q = c.state.db.query(sql); return Array.isArray(params) ? q.all(...params) : q.all(params); };
  ctx.fns.session.save = save; ctx.fns.session.load = load; ctx.fns.session.fork = fork; ctx.fns.session.getFullMessages = getFullMessages; ctx.fns.session.getMessages = getMessages; ctx.fns.session.appendMessage = (c: any, id: string, m: any) => { const q = c.state.db.query('SELECT COALESCE(MAX(idx), -1) AS n FROM messages WHERE agent_id = ?'); const idx = Number(q.get(id)?.n ?? -1) + 1; c.state.db.query('INSERT INTO messages (agent_id, idx, role, content, tool_calls, tool_call_id, ts) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, idx, m.role, typeof m.content === 'string' ? m.content : (m.content == null ? null : JSON.stringify(m.content)), m.tool_calls ? JSON.stringify(m.tool_calls) : null, m.tool_call_id ?? null, Date.now()); return { idx }; }; ctx.fns.session.appendUserMessage = appendUserMessage; ctx.fns.session.appendAssistantMessage = appendAssistantMessage;
  ctx.fns.agent.start = start;
  ctx.fns.events.emitAgentsChanged = () => {};
  return ctx;
}

describe("session.fork", () => {
  test("creates child with parent link and full-context offset", async () => {
    const ctx: any = mkCtx();
        ctx.fns.db.connect(ctx, ":memory:");
    await ctx.fns.db.migrate(ctx);
    const parent = start(ctx, { model: "openai/gpt-4o", systemPrompt: "sp", tools: [{ name: "x" }] });
    save(ctx, parent);
    appendUserMessage(ctx, parent.id, 'Hello');
    appendAssistantMessage(ctx, parent.id, { content: 'Hi!' });
    const child = fork(ctx, parent.id);
    expect(child.parentId).toBe(parent.id);
    expect(child.forkOffset).toBe(2);
    expect(child.model).toBe("openai/gpt-4o");
  });

  test("nested fork uses full parent count, not own-only count", async () => {
    const ctx: any = mkCtx();
        ctx.fns.db.connect(ctx, ":memory:");
    await ctx.fns.db.migrate(ctx);
    const gp = start(ctx, { model: "m", systemPrompt: "", tools: [] });
    save(ctx, gp);
    appendUserMessage(ctx, gp.id, 'gp msg');
    const parent = fork(ctx, gp.id);
    appendUserMessage(ctx, parent.id, 'parent msg');
    const grandchild = fork(ctx, parent.id);
    expect(ctx.fns.session.getFullMessages(ctx, parent.id).length).toBe(2);
    expect(grandchild.forkOffset).toBe(2);
  });
});
