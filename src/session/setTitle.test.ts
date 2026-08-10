import { expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

test("session.setTitle persists and updates the live agent", async () => {
    const ctx: any = await mkTestCtx();
    const agent = await ctx.fns.agent.start({ model: "mock:test", title: "Initial" });
    expect(agent.title).toBe("Initial");

    const title = await ctx.fns.session.setTitle({ id: agent.id, title: "  Renamed chat  " });
    expect(title).toBe("Renamed chat");
    expect(agent.title).toBe("Renamed chat");

    const loaded = await ctx.fns.session.load({ id: agent.id });
    expect(loaded?.title).toBe("Renamed chat");
}); 