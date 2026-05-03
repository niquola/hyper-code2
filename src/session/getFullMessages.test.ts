import { describe, test, expect } from "bun:test";
import connect from "../db/connect";
import migrate from "../db/migrate";
import save from "./save";
import getFullMessages from "./getFullMessages";
import getMessages from "./getMessages";

function mkCtx() {
  const ctx: any = { env: {}, state: {}, fns: { db: {}, session: {} } };
  ctx.fns.db.connect = connect;
  ctx.fns.db.migrate = migrate;
  ctx.fns.db.exec = (c: any, opts: { sql: string; params?: any }) => {
    const params = opts.params ?? [];
    const db = c.state.db;
    const q = db.query(opts.sql);
    const res = Array.isArray(params) ? q.run(...params) : q.run(params);
    return { changes: db.changes, lastInsertRowid: Number(res.lastInsertRowid ?? 0) };
  };
  ctx.fns.db.select = (c: any, opts: { sql: string; params?: any }) => {
    const params = opts.params ?? [];
    const q = c.state.db.query(opts.sql);
    return Array.isArray(params) ? q.all(...params) : q.all(params);
  };
  ctx.fns.session.save = save;
  ctx.fns.session.getMessages = getMessages;
  ctx.fns.session.getFullMessages = getFullMessages;
  return ctx;
}

function agent(id: string, messages: any[], extra: any = {}) {
  return {
    id, model: "m", systemPrompt: "", scratchpad: {}, messages, events: [], cursors: {}, subscribers: new Set<(ev: any, signal?: AbortSignal) => void>(), waiters: [], isStreaming: false, abortController: null,
    parentId: extra.parentId ?? null,
    forkOffset: extra.forkOffset ?? null,
  };
}

describe("session.getFullMessages", () => {
  test("chains parent messages for child", async () => {
    const ctx: any = mkCtx();
        ctx.fns.db.connect(ctx, { path: ":memory:" });
    await ctx.fns.db.migrate(ctx);
    ctx.fns.session.save(ctx, { agent: agent("parent", [{ role: "user", content: "Hello" }, { role: "assistant", content: "Hi" }, { role: "user", content: "What is 2+2?" }]) });
    ctx.fns.session.save(ctx, { agent: agent("child", [{ role: "user", content: "Child question" }, { role: "assistant", content: "Child answer" }], { parentId: "parent", forkOffset: 3 }) });
    const full = getFullMessages(ctx, { id: "child" });
    expect(full.length).toBe(5);
    expect(full[0].content).toBe("Hello");
    expect(full[2].content).toBe("What is 2+2?");
    expect(full[3].content).toBe("Child question");
    expect(full[4].content).toBe("Child answer");
  });

  test("respects offset for mid-conversation fork", async () => {
    const ctx: any = mkCtx();
        ctx.fns.db.connect(ctx, { path: ":memory:" });
    await ctx.fns.db.migrate(ctx);
    ctx.fns.session.save(ctx, { agent: agent("parent", [
      { role: "user", content: "msg1" },
      { role: "user", content: "msg2" },
      { role: "user", content: "msg3" },
      { role: "user", content: "msg4" },
    ]) });
    ctx.fns.session.save(ctx, { agent: agent("child", [{ role: "user", content: "child msg" }], { parentId: "parent", forkOffset: 2 }) });
    const full = getFullMessages(ctx, { id: "child" });
    expect(full.length).toBe(3);
    expect(full[0].content).toBe("msg1");
    expect(full[1].content).toBe("msg2");
    expect(full[2].content).toBe("child msg");
  });

  test("chains grandparent -> parent -> child", async () => {
    const ctx: any = mkCtx();
        ctx.fns.db.connect(ctx, { path: ":memory:" });
    await ctx.fns.db.migrate(ctx);
    ctx.fns.session.save(ctx, { agent: agent("gp", [{ role: "user", content: "gp msg" }]) });
    ctx.fns.session.save(ctx, { agent: agent("parent", [{ role: "user", content: "parent msg" }], { parentId: "gp", forkOffset: 1 }) });
    ctx.fns.session.save(ctx, { agent: agent("child", [{ role: "user", content: "child msg" }], { parentId: "parent", forkOffset: 2 }) });
    const full = getFullMessages(ctx, { id: "child" });
    expect(full.length).toBe(3);
    expect(full[0].content).toBe("gp msg");
    expect(full[1].content).toBe("parent msg");
    expect(full[2].content).toBe("child msg");
  });

  test("getMessages returns only own messages", async () => {
    const ctx: any = mkCtx();
        ctx.fns.db.connect(ctx, { path: ":memory:" });
    await ctx.fns.db.migrate(ctx);
    ctx.fns.session.save(ctx, { agent: agent("parent", [{ role: "user", content: "parent msg" }]) });
    ctx.fns.session.save(ctx, { agent: agent("child", [{ role: "user", content: "child msg" }], { parentId: "parent", forkOffset: 1 }) });
    const own = getMessages(ctx, { id: "child" });
    expect(own.length).toBe(1);
    expect(own[0].content).toBe("child msg");
  });
});
