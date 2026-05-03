import { test, expect, describe } from "bun:test";
import loadFns from "../loadFns";
import connect from "../db/connect";
import migrate from "../db/migrate";
import save from "./save";
import search from "./search";
import start from "../agent/start";
import nextId from "../agent/nextId";

const mkCtx = async () => {
    const ctx = { state: {}, env: {}, fns: {} as any, routes: {} } as unknown as Context;
    await loadFns(ctx);
    connect(ctx, { path: ":memory:" });
    await migrate(ctx);
    return ctx;
};

describe("session.search", () => {
    test("matches substring in user messages across all agents", async () => {
        const ctx = await mkCtx();
        const a = start(ctx, { model: "m" });
        a.messages.push({ role: "user", content: "how to deploy the telescope" });
        save(ctx, { agent: a });

        const b = start(ctx, { model: "m" });
        b.messages.push({ role: "user", content: "what is the weather" });
        save(ctx, { agent: b });

        const hits = search(ctx, { query: "telescope" });
        expect(hits).toHaveLength(1);
        expect(hits[0]!.agentId).toBe(a.id);
        expect(hits[0]!.content).toContain("telescope");
        expect(hits[0]!.role).toBe("user");
    });

    test("matches assistant and tool content too, case-insensitive", async () => {
        const ctx = await mkCtx();
        const a = start(ctx, { model: "m" });
        a.messages.push(
            { role: "user", content: "hi" },
            { role: "assistant", content: "The ANSWER is forty-two" },
            { role: "tool", tool_call_id: "c1", content: "42" },
        );
        save(ctx, { agent: a });
        const hits = search(ctx, { query: "answer" });
        expect(hits.map(h => h.role)).toContain("assistant");
    });

    test("empty query or no matches → []", async () => {
        const ctx = await mkCtx();
        const a = start(ctx, { model: "m" });
        a.messages.push({ role: "user", content: "hello" });
        save(ctx, { agent: a });
        expect(search(ctx, { query: "xyzzy" })).toEqual([]);
    });
});
