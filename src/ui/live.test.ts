import { describe, test, expect } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("ui.live", () => {
    test("a region declares where to refetch and which topic to watch — and nothing else", async () => {
        const ctx: any = await mkTestCtx();
        const html = ctx.fns.ui.live({ id: "status", url: "/agent/a/statusbar", topic: "agent:a", html: "idle" });

        expect(html).toContain('id="status"');
        expect(html).toContain('hx-get="/agent/a/statusbar"');
        expect(html).toContain('data-live-topic="agent:a"');
        expect(html).toContain(">idle</div>");
        // No cursor: state kept on both sides is state that can disagree, and
        // that disagreement is what turned an idle page into a refetch loop.
        expect(html).not.toContain("data-live-cursor");
    });

    test("the timer is a watchdog, never the mechanism", async () => {
        const ctx: any = await mkTestCtx();
        const html = ctx.fns.ui.live({ id: "x", url: "/x", topic: "t" });

        expect(html).toContain("hyper-live from:body");
        expect(html).toContain("every 30s");
        // Nobody may ask for a hot loop.
        expect(ctx.fns.ui.live({ id: "x", url: "/x", topic: "t", every: 1 })).toContain("every 5s");
    });
});
