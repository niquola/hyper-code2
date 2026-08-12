import { describe, expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("session plan", () => {
    test("creates a plan and done advances by stable id", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        const made = await ctx.fns.session.plan({ agent, title: "Ship", tasks: [
            { id: "api", title: "API", instructions: "Implement it" },
            { id: "ui", title: "UI", instructions: "Render it" },
        ] });
        expect(made.active.id).toBe("api");
        expect(agent.scratchpad.plan.tasks[0].status).toBe("active");

        const result = await ctx.fns.session.done({ agent, id: "api" });
        expect(result.next).toMatchObject({ id: "ui", instructions: "Render it" });
        expect(result.progress).toEqual({ done: 1, total: 2 });
        expect(agent.scratchpad.plan.tasks.map((t: any) => t.status)).toEqual(["done", "active"]);

        const again = await ctx.fns.session.done({ agent, id: "api" });
        expect(again.alreadyDone).toBe(true);
        expect(again.next.id).toBe("ui");
    });

    test("rejects duplicate ids", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        expect(ctx.fns.session.plan({ agent, tasks: [
            { id: "x", title: "One" }, { id: "x", title: "Two" },
        ] })).rejects.toThrow("duplicate task id");
    });

    test("only the active task can be completed", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        await ctx.fns.session.plan({ agent, tasks: [
            { id: "a", title: "A" }, { id: "b", title: "B" },
        ] });
        expect(ctx.fns.session.done({ agent, id: "b" })).rejects.toThrow('task "b" is not active');
        const loaded = await ctx.fns.session.load({ id: agent.id });
        expect(loaded.scratchpad.plan.tasks.map((task: any) => task.status)).toEqual(["active", "pending"]);
    });

    test("preserves a concurrent scratchpad update by retrying", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        await ctx.fns.session.plan({ agent, tasks: [{ id: "a", title: "A" }] });
        const originalRun = ctx.state.registry.procs.db.run;
        let injected = false;
        ctx.state.registry.procs.db.run = async (c: any, s: any, opts: any) => {
            if (!injected && String(opts.sql).includes("AND scratchpad = ?")) {
                injected = true;
                const rows = await c.fns.procs.db.select({ sql: "SELECT scratchpad FROM agents WHERE id = ?", params: [agent.id] });
                const scratchpad = JSON.parse(rows[0].scratchpad);
                scratchpad.concurrent = "kept";
                await originalRun(c, s, { sql: "UPDATE agents SET scratchpad = ? WHERE id = ?", params: [JSON.stringify(scratchpad), agent.id] });
            }
            return originalRun(c, s, opts);
        };
        await ctx.fns.session.done({ agent, id: "a" });
        expect(agent.scratchpad.concurrent).toBe("kept");
        expect(agent.scratchpad.plan.tasks[0].status).toBe("done");
    });

});
