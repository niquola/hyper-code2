import { test, expect, describe } from "bun:test";
import loadFns from "../loadFns";
import connect from "../db/connect";
import migrate from "../db/migrate";
import save from "./save";
import appendUserMessage from "./appendUserMessage";
import loadAll from "./loadAll";
import start from "../agent/start";
import nextId from "../agent/nextId";

const mkCtx = async () => {
    const ctx = { state: {}, env: {}, fns: {} as any, routes: {} } as unknown as Context;
    await loadFns(ctx);
    connect(ctx, { path: ":memory:" });
    await migrate(ctx);
    return ctx;
};

describe("session.loadAll", () => {
    test("empty db → {loaded: 0}", async () => {
        const ctx = await mkCtx();
        expect(loadAll(ctx).loaded).toBe(0);
    });

    test("rehydrates every saved agent into ctx.state.agent", async () => {
        const ctx = await mkCtx();
        const a = start(ctx, { model: "m1" });
        save(ctx, { agent: a });
        appendUserMessage(ctx, { id: a.id, text: 'hi' });
        const b = start(ctx, { model: "m2", systemPrompt: "sp" });
        save(ctx, { agent: b });

        // fresh ctx, same db — simulate restart
        const ctx2 = await mkCtx();
        (ctx2.state as any).db = (ctx.state as any).db;
        const res = loadAll(ctx2);
        expect(res.loaded).toBe(2);
        expect((ctx2.state as any).agent[a.id].messages).toEqual([{ role: "user", content: "hi" }]);
        expect((ctx2.state as any).agent[b.id].systemPrompt).toBe("sp");
    });
});
