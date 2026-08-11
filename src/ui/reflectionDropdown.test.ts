import { describe, expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("ui.reflectionDropdown", () => {
    test("renders reflection nudge and escapes its content", async () => {
        const ctx: any = await mkTestCtx({ db: false });
        const agent: any = {
            id: "aa",
            reflection: { state: {
                activity: { goal: "goal", currentStep: "step" }, tasks: [], mistakes: [],
                userSatisfaction: { level: "unknown", trend: "unknown", reasons: [] },
                reflectionNudge: { text: "verify <first>", reason: "past error", expiresAfterTurns: 2 },
            } },
        };
        const html = ctx.fns.ui.reflectionDropdown({ agent });
        expect(html).toContain("Reflection nudge · 2 turns");
        expect(html).toContain("verify &lt;first&gt;");
        expect(html).not.toContain("verify <first>");
    });
});
