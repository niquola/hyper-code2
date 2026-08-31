import { describe, expect, test } from "bun:test";
import call from "./call";

describe("llm.call", () => {
    test("uses the configured default model when model is omitted", async () => {
        let resolved = "";
        const ctx: any = { fns: {
            settings: { modelDefault: async () => "mock:test" },
            llm: { resolveEndpoint: async ({ model }: any) => { resolved = model; return { api: "mock", provider: "mock", modelId: "test", url: "mock://local", apiKey: null }; } },
        } };
        const result = await call(ctx, null, { user: "hello" });
        expect(resolved).toBe("mock:test");
        expect(result.text).toBe("hello");
    });

    test("normalizes fenced structured JSON from providers without native schema support", async () => {
        const ctx: any = { fns: {
            settings: { modelDefault: async () => "mock:test" },
            llm: { resolveEndpoint: async () => ({ api: "mock", provider: "mock", modelId: "test", url: "mock://local", apiKey: null }) },
        } };
        const format = { type: "json_schema", json_schema: { schema: { type: "object", required: ["ok"], additionalProperties: false, properties: { ok: { type: "boolean" } } } } };
        const result = await call(ctx, null, { user: "```json\n{\"ok\":true}\n```", response_format: format });
        expect(result.text).toBe('{"ok":true}');
    });
    test("never sends temperature to Codex Responses", async () => {
        const previousFetch = globalThis.fetch;
        let request: any;
        globalThis.fetch = (async (_url: any, init: any) => {
            request = JSON.parse(init.body);
            return new Response('data: {"type":"response.completed","response":{"status":"completed","output_text":"ok"}}\n\ndata: [DONE]\n\n', { status: 200 });
        }) as any;
        try {
            const token = `x.${Buffer.from(JSON.stringify({ "https://api.openai.com/auth": { chatgpt_account_id: "a" } })).toString("base64url")}.x`;
            const ctx: any = { fns: { settings: { modelDefault: async () => "codex:test" }, llm: {
                resolveEndpoint: async () => ({ api: "responses", provider: "codex", modelId: "test", url: "https://example.test", apiKey: token, account: "a" }),
                refreshCodex: async () => token,
            } } };
            await call(ctx, null, { user: "hello", temperature: 0 });
            expect(request.temperature).toBeUndefined();
        } finally { globalThis.fetch = previousFetch; }
    });

    test("retries OpenAI-compatible requests without unsupported temperature", async () => {
        const previousFetch = globalThis.fetch;
        const requests: any[] = [];
        globalThis.fetch = (async (_url: any, init: any) => {
            requests.push(JSON.parse(init.body));
            if (requests.length === 1) return new Response('{"detail":"Unsupported parameter: temperature"}', { status: 400 });
            return Response.json({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] });
        }) as any;
        try {
            const ctx: any = { fns: { settings: { modelDefault: async () => "openai:test" }, llm: {
                resolveEndpoint: async () => ({ api: "openai", provider: "openai", modelId: "test", url: "https://example.test", apiKey: "key" }),
            } } };
            const result = await call(ctx, null, { user: "hello", temperature: 0 });
            expect(result.text).toBe("ok");
            expect(requests).toHaveLength(2);
            expect(requests[0].temperature).toBe(0);
            expect(requests[1].temperature).toBeUndefined();
        } finally { globalThis.fetch = previousFetch; }
    });


    test("uses xAI OAuth and Responses fields for non-agent calls", async () => {
        const previousFetch = globalThis.fetch;
        let request: any; let headers: Headers; let recorded: any;
        globalThis.fetch = (async (_url: any, init: any) => {
            request = JSON.parse(init.body); headers = new Headers(init.headers);
            return new Response('data: {"type":"response.completed","response":{"status":"completed","output_text":"ok"}}\n\ndata: [DONE]\n\n', { status: 200, headers: { "x-ratelimit-limit-tokens": "1000", "x-ratelimit-remaining-tokens": "900" } });
        }) as any;
        try {
            const ctx: any = { fns: { settings: { modelDefault: async () => "xai:grok-4.6" }, llm: {
                resolveEndpoint: async () => ({ api: "responses", provider: "xai", modelId: "grok-4.6", url: "https://api.x.ai/v1/responses", apiKey: null, account: "default" }),
                getXaiOAuthToken: async () => "xai-token",
                recordUsage: async () => null,
                refreshUsage: async (opts: any) => { recorded = opts; },
            } } };
            const result = await call(ctx, null, { user: "hello", model: "xai:grok-4.6", sessionId: "s1" });
            expect(result.text).toBe("ok");
            expect(headers!.get("authorization")).toBe("Bearer xai-token");
            expect(headers!.get("session_id")).toBe("s1");
            expect(request).toMatchObject({ model: "grok-4.6", store: false, stream: true, include: ["reasoning.encrypted_content"] });
            expect(request.text).toBeUndefined();
            expect(recorded.provider).toBe("xai");
            expect(recorded.account).toBe("default");
            expect(recorded.maxAgeMs).toBe(60_000);
        } finally { globalThis.fetch = previousFetch; }

    });



});
