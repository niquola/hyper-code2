import { test, expect, describe } from "bun:test";
import loadFns from "../loadFns";
import connect from "../db/connect";
import migrate from "../db/migrate";
import save from "./save";
import del from "./delete";
import start from "../agent/start";

const mkCtx = async () => {
    const ctx = { state: {}, env: {}, fns: {} as any, routes: {} } as unknown as Context;
    await loadFns(ctx);
    connect(ctx, ":memory:");
    await migrate(ctx);
    return ctx;
};

describe("session.delete", () => {
    test("removes agent row + messages + events", async () => {
        const ctx = await mkCtx();
        const agent = start(ctx, { model: "m" });
        agent.messages.push({ role: "user", content: "hi" });
        agent.events.push({ type: "user", text: "hi" });
        save(ctx, agent);

        const r = del(ctx, agent.id);
        expect(r.ok).toBe(true);

        const db = (ctx.state as any).db;
        expect((db.query("SELECT COUNT(*) AS n FROM agents").get() as any).n).toBe(0);
        expect((db.query("SELECT COUNT(*) AS n FROM messages").get() as any).n).toBe(0);
        expect((db.query("SELECT COUNT(*) AS n FROM events").get() as any).n).toBe(0);
    });

    test("deleting unknown id is a no-op that returns ok:false", async () => {
        const ctx = await mkCtx();
        const r = del(ctx, "nope");
        expect(r.ok).toBe(false);
    });
});
