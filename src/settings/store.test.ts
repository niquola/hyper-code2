import { describe, test, expect } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";
import get from "./get";
import set from "./set";
import remove from "./remove";
import list from "./list";
import getNumber from "./getNumber";
import getString from "./getString";
import resolve from "../llm/resolveEndpoint";
import routePost from "../agent/$route_$id_POST";
import createAgent from "../ui/createAgent";

function installSettings(ctx: any) {
    ctx.fns.settings = {
        get,
        set,
        remove,
        list,
        getNumber,
        getString,
    };
}

describe("settings store", () => {
    test("set/get roundtrip for global and agent scopes", async () => {
        const ctx = await mkTestCtx();
        installSettings(ctx);

        ctx.fns.settings.set(ctx, {
            module: "llm",
            scopeType: "global",
            key: "defaultModel",
            value: "openai:gpt-4o-mini",
        });
        ctx.fns.settings.set(ctx, {
            module: "ui",
            scopeType: "agent",
            scopeId: "b",
            key: "debounceMs",
            value: 250,
        });

        expect(ctx.fns.settings.get(ctx, {
            module: "llm",
            scopeType: "global",
            key: "defaultModel",
        })).toBe("openai:gpt-4o-mini");

        expect(ctx.fns.settings.get(ctx, {
            module: "ui",
            scopeType: "agent",
            scopeId: "b",
            key: "debounceMs",
        })).toBe(250);
    });

    test("list returns scope entries and remove deletes one", async () => {
        const ctx = await mkTestCtx();
        installSettings(ctx);

        ctx.fns.settings.set(ctx, { module: "provider", scopeType: "provider", scopeId: "openai", key: "apiKey", value: "sk-1", isSecret: true });
        ctx.fns.settings.set(ctx, { module: "provider", scopeType: "provider", scopeId: "openai", key: "baseUrl", value: "https://api.openai.com/v1" });

        const before = ctx.fns.settings.list(ctx, { module: "provider", scopeType: "provider", scopeId: "openai" });
        expect(before.map((x: any) => x.key).sort()).toEqual(["apiKey", "baseUrl"]);

        ctx.fns.settings.remove(ctx, { module: "provider", scopeType: "provider", scopeId: "openai", key: "apiKey" });
        const after = ctx.fns.settings.list(ctx, { module: "provider", scopeType: "provider", scopeId: "openai" });
        expect(after.map((x: any) => x.key)).toEqual(["baseUrl"]);
    });

    test("getNumber/getString fall back when missing or wrong type", async () => {
        const ctx = await mkTestCtx();
        installSettings(ctx);

        ctx.fns.settings.set(ctx, { module: "ui", scopeType: "global", key: "debounceMs", value: "not-a-number" });

        expect(ctx.fns.settings.getNumber(ctx, { module: "ui", scopeType: "global", key: "debounceMs", fallback: 500 })).toBe(500);
        expect(ctx.fns.settings.getString(ctx, { module: "ui", scopeType: "global", key: "missing", fallback: "x" })).toBe("x");
    });
});

describe("settings integration", () => {
    test("resolveEndpoint prefers declared lmstudioBaseUrl setting over env/default", async () => {
        const ctx = await mkTestCtx();
        installSettings(ctx);
        ctx.fns.settings.set(ctx, {
            module: "llm",
            scopeType: "global",
            key: "lmstudioBaseUrl",
            value: "http://from-settings:9999",
        });

        const r = resolve(ctx, { model: "some-model" });
        expect(r.url).toBe("http://from-settings:9999/v1/chat/completions");
    });

    test("agent POST route uses agent setting debounceMs by default", async () => {
        const ctx = await mkTestCtx();
        installSettings(ctx);
        const agent = ctx.fns.agent.start(ctx, { model: "mock:test", systemPrompt: "" });
        ctx.fns.session.save(ctx, { agent });
        (ctx.state as any).agent = { [agent.id]: agent };

        ctx.fns.settings.set(ctx, {
            module: "ui",
            scopeType: "agent",
            scopeId: agent.id,
            key: "debounceMs",
            value: 1200,
        });

        const t0 = Date.now();
        const req = new Request("http://x/agent/" + agent.id, { method: "POST", body: "hello" });
        (req as any).params = { id: agent.id };
        const res = await routePost(ctx, null, req);
        expect(res.status).toBe(200);

        const body: any = await res.json();
        expect(body.sendAt - t0).toBeGreaterThanOrEqual(1100);
    });

    test("ui.createAgent uses settings default model when opts and env are absent", async () => {
        const ctx = await mkTestCtx();
        installSettings(ctx);
        ctx.fns.agent.systemPrompt = async () => "sys";
        ctx.fns.settings.set(ctx, {
            module: "llm",
            scopeType: "global",
            key: "defaultModel",
            value: "openai:gpt-4o-mini",
        });

        const r = await createAgent(ctx, { open: false });
        expect(r.model).toBe("openai:gpt-4o-mini");
    });
});
