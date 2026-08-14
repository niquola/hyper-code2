import { describe, expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry.ts";

describe("agent.renderEventsHtml", () => {
    // The renderer is edited while the server runs: a card can call a helper
    // that only lands a minute later, and rows keep whatever shape they were
    // written with. One bad bubble must cost one bubble.
    test("a failing event does not take the transcript down", async () => {
        const ctx: any = await mkTestCtx();
        ctx.state.registry.agent.renderEventHtml = (_c: any, _s: any, opts: any) => {
            if (opts.event.idx === 2) throw new Error("ui.popup is not a function");
            return `<p>event ${opts.event.idx}</p>`;
        };

        const html = await ctx.fns.agent.renderEventsHtml({
            agentId: "a1",
            events: [{ idx: 1 }, { idx: 2 }, { idx: 3 }],
        });

        expect(html).toContain("<p>event 1</p>");
        expect(html).toContain("<p>event 3</p>");
        expect(html).toContain("could not be rendered (#2)");
        expect(html).toContain("ui.popup is not a function");
    });
});
