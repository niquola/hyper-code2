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

});
