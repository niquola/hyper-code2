import { test, expect, describe } from "bun:test";
import script from "./script";

const ctx = {} as Context;

describe("ui.script", () => {
    test("dotted target → nested path with .js", () => {
        expect(script(ctx, null, { target: "agent.chat" })).toBe(`<script src="/agent/chat.js" defer></script>`);
    });

    test("root target → /<name>.js", () => {
        expect(script(ctx, null, { target: "main" })).toBe(`<script src="/main.js" defer></script>`);
    });

    test("deep nesting: skill.ui.widget → /skill/ui/widget.js", () => {
        expect(script(ctx, null, { target: "skill.ui.widget" })).toBe(`<script src="/skill/ui/widget.js" defer></script>`);
    });

    test("module option adds type=module", () => {
        expect(script(ctx, null, { target: "x.y", module: true })).toContain('type="module"');
    });

    test("defer: false omits defer", () => {
        expect(script(ctx, null, { target: "x.y", defer: false })).not.toContain("defer");
    });
});
