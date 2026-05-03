import { describe, test, expect } from "bun:test";
import emitAgentsChanged from "./emitAgentsChanged";
import subscribe from "./subscribe";

const mkCtx = () => ({ state: {}, env: {}, fns: { events: { subscribe, emit: (_ctx: any, opts: { event: any }) => { const s = (_ctx.state.events ??= { subs: new Set() }); for (const fn of s.subs) fn(opts.event); } } } }) as unknown as Context;

describe("events.emitAgentsChanged", () => {
  test("emits agents.changed event", () => {
    const ctx = mkCtx();
    const got: any[] = [];
    subscribe(ctx, { handler: e => got.push(e) });
    emitAgentsChanged(ctx, { agentId: "a1", reason: "fork" });
    expect(got).toEqual([{ type: "agents.changed", agentId: "a1", reason: "fork" }]);
  });
});
