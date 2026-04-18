import { test, expect, describe } from "bun:test";
import loadFns from "../loadFns";
import connect from "../db/connect";
import migrate from "../db/migrate";
import save from "./save";
import start from "../agent/start";

const mkCtx = async () => {
    const ctx = { state: {}, env: {}, fns: {} as any, routes: {} } as unknown as Context;
    await loadFns(ctx);
    connect(ctx, ":memory:");
    await migrate(ctx);
    return ctx;
};

describe("session.save", () => {
    test("upserts agent row with typed fields", async () => {
        const ctx = await mkCtx();
        const agent = start(ctx, { model: "m1", systemPrompt: "sp", tools: [{ name: "t" } as any] });
        agent.scratchpad.x = 42;
        save(ctx, agent);
        const [row] = ctx.fns.db.select<any>(ctx, "SELECT * FROM agents WHERE id = ?", [agent.id]);
        expect(row.model).toBe("m1");
        expect(row.system_prompt).toBe("sp");
        expect(JSON.parse(row.tools)).toEqual([{ name: "t" }]);
        expect(JSON.parse(row.scratchpad)).toEqual({ x: 42 });
    });

    test("each message is its own row with typed columns", async () => {
        const ctx = await mkCtx();
        const agent = start(ctx, { model: "m" });
        agent.messages.push(
            { role: "user", content: "hello" },
            { role: "assistant", content: "", tool_calls: [{ id: "c1", type: "function", function: { name: "evalCode", arguments: "{}" } }] },
            { role: "tool", tool_call_id: "c1", content: "42" },
            { role: "assistant", content: "done" },
        );
        save(ctx, agent);
        const rows = ctx.fns.db.select<any>(ctx, "SELECT * FROM messages WHERE agent_id = ? ORDER BY idx", [agent.id]);
        expect(rows).toHaveLength(4);
        expect(rows[0]!.role).toBe("user");
        expect(rows[0]!.content).toBe("hello");
        expect(JSON.parse(rows[1]!.tool_calls)[0].function.name).toBe("evalCode");
        expect(rows[2]!.role).toBe("tool");
        expect(rows[2]!.tool_call_id).toBe("c1");
    });

    test("each event is its own row with type + payload", async () => {
        const ctx = await mkCtx();
        const agent = start(ctx, { model: "m" });
        agent.events.push(
            { type: "user", text: "hi" },
            { type: "thinking", text: "..." },
            { type: "tool_call", name: "evalCode", args: { code: "1+1" }, result: "2" },
            { type: "assistant", text: "2" },
        );
        save(ctx, agent);
        const rows = ctx.fns.db.select<any>(ctx, "SELECT * FROM events WHERE agent_id = ? ORDER BY idx", [agent.id]);
        expect(rows.map(r => r.type)).toEqual(["user", "thinking", "tool_call", "assistant"]);
        expect(JSON.parse(rows[2]!.payload).name).toBe("evalCode");
    });

    test("re-save replaces messages/events (no duplicates)", async () => {
        const ctx = await mkCtx();
        const agent = start(ctx, { model: "m" });
        agent.messages.push({ role: "user", content: "a" });
        save(ctx, agent);
        agent.messages.push({ role: "assistant", content: "b" });
        save(ctx, agent);
        const [{ n }] = ctx.fns.db.select<any>(ctx, "SELECT COUNT(*) AS n FROM messages WHERE agent_id = ?", [agent.id]);
        expect(n).toBe(2);
    });
});
