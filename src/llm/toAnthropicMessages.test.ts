import { test, expect, describe } from "bun:test";
import convert from "./toAnthropicMessages";

const ctx = {} as Context;

describe("llm.toAnthropicMessages", () => {
    test("user/assistant text round-trip", () => {
        expect(convert(ctx, { messages: [
            { role: "user", content: "hi" },
            { role: "assistant", content: "hello" },
        ] })).toEqual([
            { role: "user", content: [{ type: "text", text: "hi" }] },
            { role: "assistant", content: [{ type: "text", text: "hello" }] },
        ]);
    });

    test("system messages are dropped (caller passes them as top-level 'system')", () => {
        expect(convert(ctx, { messages: [
            { role: "system", content: "sp" },
            { role: "user", content: "hi" },
        ] })).toEqual([
            { role: "user", content: [{ type: "text", text: "hi" }] },
        ]);
    });

    test("markers content (§eval, §result:eval) is just text — no special handling", () => {
        expect(convert(ctx, { messages: [
            { role: "assistant", content: "§eval\nconsole.log(1);" },
            { role: "user", content: "§result:eval\n1" },
        ] })).toEqual([
            { role: "assistant", content: [{ type: "text", text: "§eval\nconsole.log(1);" }] },
            { role: "user",      content: [{ type: "text", text: "§result:eval\n1" }] },
        ]);
    });
});
