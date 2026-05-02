import { test, expect, describe } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";
import compact from "./compact";

describe("agent.compactLastToolResult", () => {
    test("replaces last tool message content with summary", async () => {
        const ctx: any = await mkTestCtx();
        const agent = ctx.fns.agent.start(ctx, { model: "x" });
        agent.messages.push(
            { role: "user", content: "do it" },
            { role: "assistant", tool_calls: [{ id: "c1", type: "function", function: { name: "evalCode", arguments: "{}" } }] },
            { role: "tool", tool_call_id: "c1", content: "A".repeat(2000) },
        );
        ctx.fns.session = { replaceMessages: (_c: any, _id: string, next: any[]) => { agent.messages = next; }, syncAgentState: () => agent };
        const res = compact(ctx, agent, "listed 42 files");
        expect(res.replaced).toBe(true);
        expect(res.resultIdx).toBe(2); // the role='tool' (legacy) row at idx 2
        expect(res.before).toBe(2000);
        expect(agent.messages.at(-1).content).toBe("[compacted] listed 42 files");
    });

    test("returns replaced:false when no tool message exists", async () => {
        const ctx: any = await mkTestCtx();
        const agent = ctx.fns.agent.start(ctx, { model: "x" });
        agent.messages.push({ role: "user", content: "hi" });
        const res = compact(ctx, agent, "s");
        expect(res.replaced).toBe(false);
    });

    test("targets the MOST RECENT tool message when several exist", async () => {
        const ctx: any = await mkTestCtx();
        const agent = ctx.fns.agent.start(ctx, { model: "x" });
        agent.messages.push(
            { role: "tool", tool_call_id: "c1", content: "old" },
            { role: "assistant", content: "intermediate" },
            { role: "tool", tool_call_id: "c2", content: "big payload" },
        );
        ctx.fns.session = { replaceMessages: (_c: any, _id: string, next: any[]) => { agent.messages = next; }, syncAgentState: () => agent };
        compact(ctx, agent, "summary");
        expect(agent.messages[0].content).toBe("old");
        expect(agent.messages[2].content).toBe("[compacted] summary");
    });

    describe("with {message, summary} — compact from index onward", () => {
        test("drops messages from index onward and inserts a synthetic user note", async () => {
            const ctx: any = await mkTestCtx();
            const agent = ctx.fns.agent.start(ctx, { model: "x" });
            agent.messages.push(
                { role: "user", content: "hi" },
                { role: "assistant", content: "step 1 done" },
                { role: "user", content: "now do more" },
                { role: "assistant", content: "step 2 done" },
                { role: "user", content: "go deeper" },
            );
            ctx.fns.session = { replaceMessages: (_c: any, _id: string, next: any[]) => { agent.messages = next; }, syncAgentState: () => agent };
            const res = compact(ctx, agent, { message: 2, summary: "explored A/B/C dead-ends" });
            expect(res.replaced).toBe(true);
            expect(res.from).toBe(2);
            expect(agent.messages).toHaveLength(3);
            expect(agent.messages[2].role).toBe("user");
            expect(agent.messages[2].content).toContain("[compacted from #2");
        });

        test("walks back if preceding message is assistant with unanswered tool_calls", async () => {
            const ctx: any = await mkTestCtx();
            const agent = ctx.fns.agent.start(ctx, { model: "x" });
            agent.messages.push(
                { role: "user", content: "hi" },
                { role: "assistant", tool_calls: [{ id: "c1", type: "function", function: { name: "evalCode", arguments: "{}" } }] },
                { role: "tool", tool_call_id: "c1", content: "result A" },
                { role: "assistant", tool_calls: [{ id: "c2", type: "function", function: { name: "evalCode", arguments: "{}" } }] },
                { role: "tool", tool_call_id: "c2", content: "result B" },
            );
            ctx.fns.session = { replaceMessages: (_c: any, _id: string, next: any[]) => { agent.messages = next; }, syncAgentState: () => agent };
            const res = compact(ctx, agent, { message: 4, summary: "tool B too long" });
            expect(res.from).toBe(3);
            expect(agent.messages.at(-1).role).toBe("user");
            expect(agent.messages.at(-1).content).toContain("[compacted from #3");
        });

        test("invalid index → replaced:false", async () => {
            const ctx: any = await mkTestCtx();
            const agent = ctx.fns.agent.start(ctx, { model: "x" });
            agent.messages.push({ role: "user", content: "hi" });
            expect(compact(ctx, agent, { message: 99, summary: "x" }).replaced).toBe(false);
            expect(compact(ctx, agent, { message: -1, summary: "x" }).replaced).toBe(false);
        });
    });
});
