import { describe, test, expect } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("events.emitAgentsChanged", () => {
  test("emits agents.changed event", async () => {
    const ctx = await mkTestCtx();
    const got: any[] = [];
    ctx.fns.procs.events.subscribe({ handler: (e: any) => got.push(e) });
    ctx.fns.events.emitAgentsChanged({ agentId: "a1", reason: "fork" });
    // Addressed to the "agents" topic, and followed by the refresh that tells
    // every tab showing the list to ask for it again.
    expect(got).toEqual([
        { type: "agents.changed", agentId: "a1", reason: "fork", topic: "agents" },
        { type: "refresh", reason: "fork", topic: "agents" },
    ]);
  });
});
