import { test, expect, describe } from "bun:test";
import listModels from "./listModels";

describe("llm.listModels", () => {
    test("always returns remote provider groups even with no LM Studio", async () => {
        const ctx = { env: { LMSTUDIO_URL: "http://127.0.0.1:9" } } as unknown as Context;  // unreachable
        const groups = await listModels(ctx);
        expect(groups.kimi).toBeDefined();
        expect(groups.openai).toBeDefined();
        expect(groups.kimi!.every(m => m.startsWith("kimi:"))).toBe(true);
        expect(groups.openai!.every(m => m.startsWith("openai:"))).toBe(true);
    });
});
