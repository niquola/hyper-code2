import { describe, expect, test } from "bun:test";
import localize from "./localize";

describe("llm.localize", () => {
    test("batches capabilities and reports individual failures", async () => {
        const ctx: any = { fns: {
            settings: { modelDefault: async () => "mock:test" },
            llm: { call: async ({ user }: any) => {
                const item = JSON.parse(user).capability;
                if (item.name === "bad") throw new Error("boom");
                return { text: JSON.stringify({ name: item.name, text: "русский поисковый текст ".repeat(10) }) };
            } },
        } };
        const result = await localize(ctx, null, { functions: [{ name: "good", text: "good" }, { name: "bad", text: "bad" }], locales: ["ru"] });
        expect(result.localized.good).toBeDefined();
        expect(result.localized.good!.length).toBeGreaterThan(120);
        expect(result.localized.bad).toBeUndefined();
        expect(result.failed).toEqual(["bad"]);
    });
});
