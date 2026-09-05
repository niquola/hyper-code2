import { describe, expect, test } from "bun:test";
import version from "./claudeCodeCliVersion";

describe("llm.claudeCodeCliVersion", () => {
    test("honors explicit environment override", async () => {
        const ctx: any = { env: { CLAUDE_CODE_CLI_VERSION: "9.8.7" }, state: {} };
        expect(await version(ctx, null, {})).toBe("9.8.7");
    });

    test("detects a semantic version and caches it", async () => {
        const ctx: any = { env: { HOME: process.env.HOME, PATH: process.env.PATH }, state: {} };
        const found = await version(ctx, null, {});
        expect(found).toMatch(/^\d+\.\d+\.\d+$/);
        expect(ctx.state.llm.claudeCodeCliVersion).toBe(found);
    });
});
