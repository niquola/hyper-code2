import { describe, test, expect } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("session.updateScratchpad", () => {
  test("updates scratchpad without touching messages/events", async () => {
    const ctx: any = await mkTestCtx();
    const agent = await ctx.fns.agent.start({ model: "m", systemPrompt: "" });
    agent.messages = [{ role: "user", content: "hello" }];
    agent.events = [{ type: "user", text: "hello" }];
    await ctx.fns.session.save({ agent });
    await ctx.fns.session.updateScratchpad({ id: agent.id, scratchpad: { x: 1 } });
    const loaded = (await ctx.fns.session.load({ id: agent.id }))!;
    expect(loaded.scratchpad).toEqual({ x: 1 });
    expect(loaded.messages).toHaveLength(1);
    expect(loaded.events).toHaveLength(1);
  });
});
