import { test, expect, describe } from "bun:test";
import start from "./start";
import compact from "./compact";

const mkCtx = () => ({ state: {}, env: {} } as unknown as Context);

describe("agent.compactLastToolResult", () => {
    test("replaces last tool message content with summary", () => {
        const ctx = mkCtx();
        const agent = start(ctx, { model: "x" });
        agent.messages.push(
            { role: "user", content: "do it" },
            { role: "assistant", tool_calls: [{ id: "c1", type: "function", function: { name: "evalCode", arguments: "{}" } }] },
            { role: "tool", tool_call_id: "c1", content: "A".repeat(2000) },
        );
        const res = compact(ctx, agent, "listed 42 files");
        expect(res.replaced).toBe(true);
        expect(res.toolCallId).toBe("c1");
        expect(res.before).toBe(2000);
        expect(agent.messages.at(-1).content).toBe("[compacted] listed 42 files");
    });

    test("returns replaced:false when no tool message exists", () => {
        const ctx = mkCtx();
        const agent = start(ctx, { model: "x" });
        agent.messages.push({ role: "user", content: "hi" });
        const res = compact(ctx, agent, "s");
        expect(res.replaced).toBe(false);
    });

    test("targets the MOST RECENT tool message when several exist", () => {
        const ctx = mkCtx();
        const agent = start(ctx, { model: "x" });
        agent.messages.push(
            { role: "tool", tool_call_id: "c1", content: "old" },
            { role: "assistant", content: "intermediate" },
            { role: "tool", tool_call_id: "c2", content: "big payload" },
        );
        compact(ctx, agent, "summary");
        expect(agent.messages[0].content).toBe("old");
        expect(agent.messages[2].content).toBe("[compacted] summary");
    });

    describe("with {message, summary} — compact from index onward", () => {
        test("drops messages from index onward and inserts a synthetic user note", () => {
            const ctx = mkCtx();
            const agent = start(ctx, { model: "x" });
            agent.messages.push(
                { role: "user", content: "hi" },
                { role: "assistant", content: "step 1 done" },
                { role: "user", content: "now do more" },
                { role: "assistant", content: "step 2 done" },
                { role: "user", content: "go deeper" },
            );
            const res = compact(ctx, agent, { message: 2, summary: "explored A/B/C dead-ends" });
            expect(res.replaced).toBe(true);
            expect(res.from).toBe(2);
            expect(agent.messages).toHaveLength(3);
            expect(agent.messages[0].content).toBe("hi");
            expect(agent.messages[1].content).toBe("step 1 done");
            expect(agent.messages[2].role).toBe("user");
            expect(agent.messages[2].content).toContain("[compacted from #2");
            expect(agent.messages[2].content).toContain("explored A/B/C dead-ends");
        });

        test("walks back if preceding message is assistant with unanswered tool_calls", () => {
            const ctx = mkCtx();
            const agent = start(ctx, { model: "x" });
            agent.messages.push(
                { role: "user", content: "hi" },
                { role: "assistant", tool_calls: [{ id: "c1", type: "function", function: { name: "evalCode", arguments: "{}" } }] },
                { role: "tool", tool_call_id: "c1", content: "result A" },
                { role: "assistant", tool_calls: [{ id: "c2", type: "function", function: { name: "evalCode", arguments: "{}" } }] },
                { role: "tool", tool_call_id: "c2", content: "result B" },
            );
            // user asks to drop from idx 4 (just the tool result B) — should walk back to idx 3 to remove the assistant too
            const res = compact(ctx, agent, { message: 4, summary: "tool B too long" });
            expect(res.from).toBe(3);
            expect(agent.messages.at(-1).role).toBe("user");
            expect(agent.messages.at(-1).content).toContain("[compacted from #3");
            // tail must NOT be an orphan assistant with unanswered tool_calls
            expect(agent.messages[agent.messages.length - 2].role).toBe("tool");
        });

        test("invalid index → replaced:false", () => {
            const ctx = mkCtx();
            const agent = start(ctx, { model: "x" });
            agent.messages.push({ role: "user", content: "hi" });
            expect(compact(ctx, agent, { message: 99, summary: "x" }).replaced).toBe(false);
            expect(compact(ctx, agent, { message: -1, summary: "x" }).replaced).toBe(false);
        });
    });
});
