import { test, expect, describe } from "bun:test";
import listModels from "./listModels";

describe("llm.listModels", () => {
    test("always returns remote provider groups even with no LM Studio", async () => {
        const ctx = { env: { LMSTUDIO_URL: "http://127.0.0.1:9" } } as unknown as Context;  // unreachable
        const groups = await listModels(ctx, null);
        expect(groups.kimi).toBeDefined();
        expect(groups["kimi-coding"]).toEqual([
            "kimi-coding:k3",
            "kimi-coding:k3-256k",
            "kimi-coding:kimi-for-coding",
            "kimi-coding:kimi-for-coding-highspeed",
        ]);
        expect(groups.kimi).toContain("kimi:kimi-k3");
        expect(groups.openai).toBeDefined();
        expect(groups.kimi!.every(m => m.startsWith("kimi:"))).toBe(true);
        expect(groups.openai!.every(m => m.startsWith("openai:"))).toBe(true);
    });
});
