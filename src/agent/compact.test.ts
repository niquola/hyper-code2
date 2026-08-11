import { test, expect, describe } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";
import compact from "./compact";

describe("agent.compact", () => {
    test("replaces the last tool result with a summary", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "x" });
        agent.messages.push(
            { role: "user", content: "do it" },
            { role: "assistant", content: "", tool_calls: [{ id: "c1", name: "eval", args: {} }] },
            { role: "tool", content: "A".repeat(2000), tool_call_id: "c1" },
        );
        ctx.fns.session = { replaceMessages: (_c: any, _s: any, opts: { id: string; messages: any[] }) => { agent.messages = opts.messages; }, syncAgentState: () => agent };
        const res = await compact(ctx, null, { agent, summary: "listed 42 files" });
        expect(res.replaced).toBe(true);
        expect(res.resultIdx).toBe(2);
        expect(agent.messages.at(-1).content).toBe("[compacted] listed 42 files");
    });

    test("returns replaced:false when no tool-result exists", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "x" });
        agent.messages.push({ role: "user", content: "hi" });
        expect((await compact(ctx, null, { agent, summary: "s" })).replaced).toBe(false);
    });

    test("targets the MOST RECENT result when several exist", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "x" });
        agent.messages.push(
            { role: "tool", content: "old", tool_call_id: "c0" },
            { role: "assistant", content: "intermediate" },
            { role: "tool", content: "big payload", tool_call_id: "c1" },
        );
        ctx.fns.session = { replaceMessages: (_c: any, _s: any, opts: { id: string; messages: any[] }) => { agent.messages = opts.messages; }, syncAgentState: () => agent };
        await compact(ctx, null, { agent, summary: "summary" });
        expect(agent.messages[0].content).toBe("old");
        expect(agent.messages[2].content).toBe("[compacted] summary");
    });

    describe("with {message, summary} — compact from index onward", () => {
        test("drops messages from index onward and inserts a synthetic user note", async () => {
            const ctx: any = await mkTestCtx();
            const agent = await ctx.fns.agent.start({ model: "x" });
            agent.messages.push(
                { role: "user", content: "hi" },
                { role: "assistant", content: "step 1 done" },
                { role: "user", content: "now do more" },
                { role: "assistant", content: "step 2 done" },
                { role: "user", content: "go deeper" },
            );
            ctx.fns.session = { replaceMessages: (_c: any, _s: any, opts: { id: string; messages: any[] }) => { agent.messages = opts.messages; }, syncAgentState: () => agent };
            const res = await compact(ctx, null, { agent, message: 2, summary: "explored A/B/C dead-ends" });
            expect(res.replaced).toBe(true);
            expect(res.from).toBe(2);
            expect(agent.messages).toHaveLength(3);
            expect(agent.messages[2].role).toBe("user");
            expect(agent.messages[2].content).toContain("[compacted from #2");
        });

        test("walks back when the row before is a tool call", async () => {
            const ctx: any = await mkTestCtx();
            const agent = await ctx.fns.agent.start({ model: "x" });
            agent.messages.push(
                { role: "user", content: "hi" },
                { role: "assistant", content: "", tool_calls: [{ id: "c1", name: "eval", args: {} }] },
                { role: "tool", content: "result A", tool_call_id: "c1" },
                { role: "assistant", content: "", tool_calls: [{ id: "c2", name: "eval", args: {} }] },
                { role: "tool", content: "result B", tool_call_id: "c2" },
            );
            ctx.fns.session = { replaceMessages: (_c: any, _s: any, opts: { id: string; messages: any[] }) => { agent.messages = opts.messages; }, syncAgentState: () => agent };
            // Asking to compact at idx 4 (a result) walks back over the result
            // and its marker assistant — landing at idx 3.
            const res = await compact(ctx, null, { agent, message: 4, summary: "tool B too long" });
            expect(res.from).toBe(3);
            expect(agent.messages.at(-1).role).toBe("user");
            expect(agent.messages.at(-1).content).toContain("[compacted from #3");
        });

        test("invalid index → replaced:false", async () => {
            const ctx: any = await mkTestCtx();
            const agent = await ctx.fns.agent.start({ model: "x" });
            agent.messages.push({ role: "user", content: "hi" });
            expect((await compact(ctx, null, { agent, message: 99, summary: "x" })).replaced).toBe(false);
            expect((await compact(ctx, null, { agent, message: -1, summary: "x" })).replaced).toBe(false);
        });
    });
});
