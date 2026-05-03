import { test, expect, describe } from "bun:test";
import loadFns from "../loadFns";
import connect from "../db/connect";
import migrate from "../db/migrate";
import save from "./save";
import replaceMessages from "./replaceMessages";
import replaceEvents from "./replaceEvents";
import load from "./load";
import start from "../agent/start";
import nextId from "../agent/nextId";

const mkCtx = async () => {
    const ctx = { state: {}, env: {}, fns: {} as any, routes: {} } as unknown as Context;
    await loadFns(ctx);
    connect(ctx, { path: ":memory:" });
    await migrate(ctx);
    return ctx;
};

describe("session.load", () => {
    test("returns null when id unknown", async () => {
        const ctx = await mkCtx();
        expect(load(ctx, { id: "nope" })).toBeNull();
    });

    test("round-trip: save → load reconstructs agent shape", async () => {
        const ctx = await mkCtx();
        const original = start(ctx, { model: "m", systemPrompt: "sp" });
        original.scratchpad.note = 'remember';
        save(ctx, { agent: original });
        replaceMessages(ctx, { id: original.id, messages: [
            { role: 'user', content: 'a' },
            { role: 'assistant', content: '§eval\nconsole.log(1);' },
            { role: 'user', content: '§result:eval\n1' },
        ] });
        replaceEvents(ctx, { id: original.id, events: [
            { type: 'user', text: 'a' },
            { type: 'tool_call', name: 'eval', args: { code: 'console.log(1);' }, result: '1' },
        ] });

        const ctx2 = await mkCtx();
        (ctx2.state as any).db = (ctx.state as any).db;
        const loaded = load(ctx2, { id: original.id });
        expect(loaded).not.toBeNull();
        expect(loaded!.id).toBe(original.id);
        expect(loaded!.model).toBe("m");
        expect(loaded!.systemPrompt).toBe("sp");
        expect(loaded!.messages).toEqual([
            { role: 'user', content: 'a' },
            { role: 'assistant', content: '§eval\nconsole.log(1);' },
            { role: 'user', content: '§result:eval\n1' },
        ]);
        expect(loaded!.events).toEqual([
            { type: 'user', text: 'a' },
            { type: 'tool_call', name: 'eval', args: { code: 'console.log(1);' }, result: '1' },
        ]);
        expect(loaded!.scratchpad).toEqual({ note: "remember" });
        expect(loaded!.isStreaming).toBe(false);
    });
});
