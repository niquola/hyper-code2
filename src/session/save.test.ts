import { test, expect, describe } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("session.save", () => {
    test("upserts agent row with typed fields", async () => {
        const ctx: any = await mkTestCtx();
        const agent = ctx.fns.agent.start({ model: "m1", systemPrompt: "sp" });
        agent.scratchpad.x = 42;
        ctx.fns.session.save({ agent });
        const [row] = ctx.fns.procs.db.select({ sql: "SELECT * FROM agents WHERE id = ?", params: [agent.id] }) as any[];
        expect(row.model).toBe("m1");
        expect(row.system_prompt).toBe("sp");
        expect(JSON.parse(row.scratchpad)).toEqual({ x: 42 });
    });

    test("save persists current in-memory messages/events", async () => {
        const ctx: any = await mkTestCtx();
        const agent = ctx.fns.agent.start({ model: "m" });
        ctx.fns.session.save({ agent });
        agent.messages.push({ role: "user", content: "hello" } as any);
        agent.events.push({ type: "user", text: "hello" } as any);
        agent.scratchpad.note = "x";
        ctx.fns.session.save({ agent });
        const msgs = ctx.fns.procs.db.select({ sql: "SELECT * FROM messages WHERE agent_id = ? ORDER BY idx", params: [agent.id] }) as any[];
        const evs = ctx.fns.procs.db.select({ sql: "SELECT * FROM events WHERE agent_id = ? ORDER BY idx", params: [agent.id] }) as any[];
        expect(msgs.map((m: any) => m.content)).toEqual(["hello"]);
        expect(evs.map((e: any) => e.type)).toEqual(["user"]);
    });
});
