import { describe, test, expect } from "bun:test";
import connect from "../db/connect";
import migrate from "../db/migrate";
import save from "./save";
import load from "./load";
import getMessages from "./getMessages";
import getEvents from "./getEvents";
import syncAgentState from "./syncAgentState";
import updateScratchpad from "./updateScratchpad";
import start from "../agent/start";
import nextId from "../agent/nextId";

function mkCtx() {
  const ctx: any = { env: {}, state: {}, fns: { db: {}, session: {}, agent: { nextId } } };
  ctx.fns.db.connect = connect;
  ctx.fns.db.migrate = migrate;
  ctx.fns.db.exec = (c: any, opts: { sql: string; params?: any }) => { const params = opts.params ?? []; const q = c.state.db.query(opts.sql); const res = Array.isArray(params) ? q.run(...params) : q.run(params); return { changes: c.state.db.changes, lastInsertRowid: Number(res.lastInsertRowid ?? 0) }; };
  ctx.fns.db.select = (c: any, opts: { sql: string; params?: any }) => { const params = opts.params ?? []; const q = c.state.db.query(opts.sql); return Array.isArray(params) ? q.all(...params) : q.all(params); };
  ctx.fns.session.save = save;
  ctx.fns.session.load = load;
  ctx.fns.session.getMessages = getMessages;
  ctx.fns.session.getEvents = getEvents;
  ctx.fns.session.syncAgentState = syncAgentState;
  ctx.fns.session.updateScratchpad = updateScratchpad;
  return ctx;
}

describe("session.updateScratchpad", () => {
  test("updates scratchpad without touching messages/events", async () => {
    const ctx = mkCtx();
    ctx.fns.db.connect(ctx, { path: ":memory:" });
    await ctx.fns.db.migrate(ctx);
    const agent = start(ctx as any, { model: "m", systemPrompt: "" });
    agent.messages = [{ role: "user", content: "hello" }];
    agent.events = [{ type: "user", text: "hello" }];
    save(ctx as any, { agent });
    ctx.fns.session.updateScratchpad(ctx as any, { id: agent.id, scratchpad: { x: 1 } });
    const loaded = load(ctx as any, { id: agent.id })!;
    expect(loaded.scratchpad).toEqual({ x: 1 });
    expect(loaded.messages).toHaveLength(1);
    expect(loaded.events).toHaveLength(1);
  });
});
