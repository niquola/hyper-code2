import { test, expect, describe } from "bun:test";
import loadFns from "../loadFns";
import connect from "../db/connect";
import migrate from "../db/migrate";
import save from "./save";
import load from "./load";
import start from "../agent/start";

const mkCtx = async () => {
    const ctx = { state: {}, env: {}, fns: {} as any, routes: {} } as unknown as Context;
    await loadFns(ctx);
    connect(ctx, ":memory:");
    await migrate(ctx);
    return ctx;
};

describe("session.load", () => {
    test("returns null when id unknown", async () => {
        const ctx = await mkCtx();
        expect(load(ctx, "nope")).toBeNull();
    });

    test("round-trip: save → load reconstructs agent shape", async () => {
        const ctx = await mkCtx();
        const original = start(ctx, { model: "m", systemPrompt: "sp", tools: [{ name: "t" } as any] });
        original.messages.push(
            { role: "user", content: "a" },
            { role: "assistant", content: "", tool_calls: [{ id: "c1", type: "function", function: { name: "evalCode", arguments: "{\"x\":1}" } }] },
            { role: "tool", tool_call_id: "c1", content: "result" },
        );
        original.events.push(
            { type: "user", text: "a" },
            { type: "tool_call", name: "evalCode", args: { x: 1 }, result: "result" },
        );
        original.scratchpad.note = "remember";
        save(ctx, original);

        // fresh ctx (just same db) to ensure load doesn't rely on in-memory agent
        const ctx2 = await mkCtx();
        // rewire to share the same db so the saved row is visible
        (ctx2.state as any).db = (ctx.state as any).db;
        const loaded = load(ctx2, original.id);
        expect(loaded).not.toBeNull();
        expect(loaded!.id).toBe(original.id);
        expect(loaded!.model).toBe("m");
        expect(loaded!.systemPrompt).toBe("sp");
        expect(loaded!.tools).toEqual([{ name: "t" }]);
        expect(loaded!.messages).toEqual(original.messages);
        expect(loaded!.events).toEqual(original.events);
        expect(loaded!.scratchpad).toEqual({ note: "remember" });
        expect(loaded!.isStreaming).toBe(false);
    });
});
