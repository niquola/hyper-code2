import { describe, expect, test } from "bun:test";
import capabilities from "./reasoningCapabilities";

describe("llm.reasoningCapabilities xAI", () => {
    test("Grok 4 subscription models expose Responses effort levels", async () => {
        const result = await capabilities({} as Context, null, { model: "xai/work:grok-4.6" });
        expect(result.mode).toBe("openai-effort");
        expect(result.defaultEffort).toBe("medium");
        expect(result.supported).toEqual(["auto", "off", "minimal", "low", "medium", "high", "xhigh"]);
    });
});
