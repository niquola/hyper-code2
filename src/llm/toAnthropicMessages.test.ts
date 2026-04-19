import { test, expect, describe } from "bun:test";
import convert from "./toAnthropicMessages";

describe("llm.toAnthropicMessages", () => {
    test("user/assistant text round-trip", () => {
        expect(convert([
            { role: "user", content: "hi" },
            { role: "assistant", content: "hello" },
        ])).toEqual([
            { role: "user", content: [{ type: "text", text: "hi" }] },
            { role: "assistant", content: [{ type: "text", text: "hello" }] },
        ]);
    });

    test("assistant with tool_calls becomes text + tool_use blocks", () => {
        const out = convert([
            { role: "user", content: "do it" },
            {
                role: "assistant",
                content: "ok",
                tool_calls: [
                    { id: "c1", type: "function", function: { name: "evalCode", arguments: "{\"code\":\"1+1\"}" } },
                ],
            },
        ]);
        expect(out[1]).toEqual({
            role: "assistant",
            content: [
                { type: "text", text: "ok" },
                { type: "tool_use", id: "c1", name: "evalCode", input: { code: "1+1" } },
            ],
        });
    });

    test("single tool message → user with single tool_result", () => {
        const out = convert([
            { role: "tool", tool_call_id: "c1", content: "2" },
        ]);
        expect(out).toEqual([
            { role: "user", content: [{ type: "tool_result", tool_use_id: "c1", content: "2" }] },
        ]);
    });

    test("consecutive tool messages collapse into one user message", () => {
        const out = convert([
            { role: "assistant", tool_calls: [
                { id: "c1", type: "function", function: { name: "a", arguments: "{}" } },
                { id: "c2", type: "function", function: { name: "b", arguments: "{}" } },
            ] },
            { role: "tool", tool_call_id: "c1", content: "one" },
            { role: "tool", tool_call_id: "c2", content: "two" },
            { role: "assistant", content: "done" },
        ]);
        expect(out).toHaveLength(3);
        expect(out[1]).toEqual({
            role: "user",
            content: [
                { type: "tool_result", tool_use_id: "c1", content: "one" },
                { type: "tool_result", tool_use_id: "c2", content: "two" },
            ],
        });
        expect(out[2]).toEqual({ role: "assistant", content: [{ type: "text", text: "done" }] });
    });

    test("system messages are dropped (caller passes them as top-level 'system')", () => {
        const out = convert([
            { role: "system", content: "sp" },
            { role: "user", content: "hi" },
        ]);
        expect(out).toEqual([
            { role: "user", content: [{ type: "text", text: "hi" }] },
        ]);
    });

    test("assistant with no text and only tool_calls omits empty text block", () => {
        const out = convert([
            { role: "assistant", content: "", tool_calls: [
                { id: "c1", type: "function", function: { name: "x", arguments: "{}" } },
            ] },
        ]);
        expect(out[0].content).toEqual([
            { type: "tool_use", id: "c1", name: "x", input: {} },
        ]);
    });

    test("bad JSON in tool_call arguments defaults to {}", () => {
        const out = convert([
            { role: "assistant", tool_calls: [
                { id: "c", type: "function", function: { name: "x", arguments: "not-json" } },
            ] },
        ]);
        expect((out[0].content as any[])[0]).toEqual({ type: "tool_use", id: "c", name: "x", input: {} });
    });
});
