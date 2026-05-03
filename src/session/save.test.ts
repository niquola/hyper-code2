import { test, expect, describe } from "bun:test";
import loadFns from "../loadFns";
import connect from "../db/connect";
import migrate from "../db/migrate";
import save from "./save";
import appendMessage from "./appendMessage";
import appendEvent from "./appendEvent";
import start from "../agent/start";
import nextId from "../agent/nextId";

const mkCtx = async () => {
    const ctx = { state: {}, env: {}, fns: {} as any, routes: {} } as unknown as Context;
    await loadFns(ctx);
    connect(ctx, { path: ":memory:" });
    await migrate(ctx);
    return ctx;
};

describe("session.save", () => {
    test("upserts agent row with typed fields", async () => {
        const ctx = await mkCtx();
        const agent = start(ctx, { model: "m1", systemPrompt: "sp" });
        agent.scratchpad.x = 42;
        save(ctx, { agent });
        const [row] = ctx.fns.db.select<any>(ctx, { sql: "SELECT * FROM agents WHERE id = ?", params: [agent.id] });
        expect(row.model).toBe("m1");
        expect(row.system_prompt).toBe("sp");
        expect(JSON.parse(row.scratchpad)).toEqual({ x: 42 });
    });

    test("save persists current in-memory messages/events", async () => {
        const ctx = await mkCtx();
        const agent = start(ctx, { model: "m" });
        save(ctx, { agent });
        agent.messages.push({ role: "user", content: "hello" } as any);
        agent.events.push({ type: "user", text: "hello" } as any);
        agent.scratchpad.note = "x";
        save(ctx, { agent });
        const msgs = ctx.fns.db.select<any>(ctx, { sql: "SELECT * FROM messages WHERE agent_id = ? ORDER BY idx", params: [agent.id] });
        const evs = ctx.fns.db.select<any>(ctx, { sql: "SELECT * FROM events WHERE agent_id = ? ORDER BY idx", params: [agent.id] });
        expect(msgs.map((m: any) => m.content)).toEqual(["hello"]);
        expect(evs.map((e: any) => e.type)).toEqual(["user"]);
    });
});
