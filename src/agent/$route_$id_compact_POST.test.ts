import { describe, test, expect } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("POST /agent/:id/compact", () => {
  test("dispatches manual compaction and exposes top-bar control", async () => {
    const ctx = await mkTestCtx();
    const agent: any = { id: "a1", model: "test:model", messages: [], events: [], scratchpad: {}, workspaceDir: process.cwd(), systemPrompt: "" };
    (ctx.state as any).agent = { a1: agent };
    ctx.state.registry.agent.compactContext = (_c: any, _s: any, o: any) => ({ status: "compacted", tokensBefore: 10, instructions: o.instructions });
    const body = new FormData(); body.set("instructions", "focus tests");
    const res = await ctx.fns.procs.http.dispatch({ method: "POST", url: "/agent/a1/compact", body });
    expect(res.status).toBe(204);
    expect(res.headers.get("x-compaction-status")).toBe("compacted");
    ctx.state.registry.session.getMaxEventIdx = () => -1;
    ctx.state.registry.session.getEvents = () => [];
    ctx.state.registry.session.getFullMessages = () => [];
    const html = await ctx.fns.ui.chatColumn({ agentId: "a1" });
    expect(html).toContain("Compact context");
    expect(html).toContain("/agent/a1/compact");
    expect(html).toContain('popovertarget="compact-popover-a1"');
    expect(html).toContain('anchor-name:--inplace-compact-popover-a1');
    expect(html).toContain('class="inplace-popup-panel"');
    expect(html).toContain('aria-haspopup="dialog"');
  });
});
