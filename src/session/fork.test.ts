import { describe, test, expect } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("session.fork", () => {
  test("creates child with parent link and full-context offset", async () => {
    const ctx: any = await mkTestCtx();
    ctx.fns.agent.renderEventHtml = async (_c: any, _s: any, _o: any) => '';
    const parent = await ctx.fns.agent.start({ model: "openai/gpt-4o", systemPrompt: "sp" });
    await ctx.fns.session.save({ agent: parent });
    await ctx.fns.session.appendUserMessage({ id: parent.id, text: 'Hello' });
    await ctx.fns.session.appendAssistantMessage({ id: parent.id, msg: { content: 'Hi!' } });
    const child = await ctx.fns.session.fork({ id: parent.id });
    expect(child.parentId).toBe(parent.id);
    expect(child.forkOffset).toBe(2);
    expect(child.model).toBe("openai/gpt-4o");
  });

  test("nested fork uses full parent count, not own-only count", async () => {
    const ctx: any = await mkTestCtx();
    ctx.fns.agent.renderEventHtml = async (_c: any, _s: any, _o: any) => '';
    const gp = await ctx.fns.agent.start({ model: "m", systemPrompt: "" });
    await ctx.fns.session.save({ agent: gp });
    await ctx.fns.session.appendUserMessage({ id: gp.id, text: 'gp msg' });
    const parent = await ctx.fns.session.fork({ id: gp.id });
    await ctx.fns.session.appendUserMessage({ id: parent.id, text: 'parent msg' });
    const grandchild = await ctx.fns.session.fork({ id: parent.id });
    expect((await ctx.fns.session.getFullMessages({ id: parent.id })).length).toBe(2);
    expect(grandchild.forkOffset).toBe(2);
  });
});
