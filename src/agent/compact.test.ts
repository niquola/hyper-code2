import { test, expect, describe } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";
import compact from "./compact";

describe("agent.compact", () => {
    test("replaces last §result:* user message with summary", async () => {
        const ctx: any = await mkTestCtx();
        const agent = ctx.fns.agent.start(ctx, { model: "x" });
        agent.messages.push(
            { role: "user", content: "do it" },
            { role: "assistant", content: "§eval\nconsole.log(1);" },
            { role: "user", content: "§result:eval\n" + "A".repeat(2000) },
        );
        ctx.fns.session = { replaceMessages: (_c: any, opts: { id: string; messages: any[] }) => { agent.messages = opts.messages; }, syncAgentState: () => agent };
        const res = compact(ctx, { agent, summary: "listed 42 files" });
        expect(res.replaced).toBe(true);
        expect(res.resultIdx).toBe(2);
        expect(agent.messages.at(-1).content).toBe("[compacted] listed 42 files");
    });

    test("returns replaced:false when no tool-result exists", async () => {
        const ctx: any = await mkTestCtx();
        const agent = ctx.fns.agent.start(ctx, { model: "x" });
        agent.messages.push({ role: "user", content: "hi" });
        expect(compact(ctx, { agent, summary: "s" }).replaced).toBe(false);
    });

    test("targets the MOST RECENT result when several exist", async () => {
        const ctx: any = await mkTestCtx();
        const agent = ctx.fns.agent.start(ctx, { model: "x" });
        agent.messages.push(
            { role: "user", content: "§result:eval\nold" },
            { role: "assistant", content: "intermediate" },
            { role: "user", content: "§result:eval\nbig payload" },
        );
        ctx.fns.session = { replaceMessages: (_c: any, opts: { id: string; messages: any[] }) => { agent.messages = opts.messages; }, syncAgentState: () => agent };
        compact(ctx, { agent, summary: "summary" });
        expect(agent.messages[0].content).toBe("§result:eval\nold");
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
            ctx.fns.session = { replaceMessages: (_c: any, opts: { id: string; messages: any[] }) => { agent.messages = opts.messages; }, syncAgentState: () => agent };
            const res = compact(ctx, { agent, message: 2, summary: "explored A/B/C dead-ends" });
            expect(res.replaced).toBe(true);
            expect(res.from).toBe(2);
            expect(agent.messages).toHaveLength(3);
            expect(agent.messages[2].role).toBe("user");
            expect(agent.messages[2].content).toContain("[compacted from #2");
        });

        test("walks back when from-1 is an assistant marker", async () => {
            const ctx: any = await mkTestCtx();
            const agent = ctx.fns.agent.start(ctx, { model: "x" });
            agent.messages.push(
                { role: "user", content: "hi" },
                { role: "assistant", content: "§eval\nconsole.log(1);" },
                { role: "user", content: "§result:eval\nresult A" },
                { role: "assistant", content: "§eval\nconsole.log(2);" },
                { role: "user", content: "§result:eval\nresult B" },
            );
            ctx.fns.session = { replaceMessages: (_c: any, opts: { id: string; messages: any[] }) => { agent.messages = opts.messages; }, syncAgentState: () => agent };
            // Asking to compact at idx 4 (a result) walks back over the result
            // and its marker assistant — landing at idx 3.
            const res = compact(ctx, { agent, message: 4, summary: "tool B too long" });
            expect(res.from).toBe(3);
            expect(agent.messages.at(-1).role).toBe("user");
            expect(agent.messages.at(-1).content).toContain("[compacted from #3");
        });

        test("invalid index → replaced:false", async () => {
            const ctx: any = await mkTestCtx();
            const agent = ctx.fns.agent.start(ctx, { model: "x" });
            agent.messages.push({ role: "user", content: "hi" });
            expect(compact(ctx, { agent, message: 99, summary: "x" }).replaced).toBe(false);
            expect(compact(ctx, { agent, message: -1, summary: "x" }).replaced).toBe(false);
        });
    });
});
