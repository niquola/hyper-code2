import { describe, expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry.ts";

describe("ui.layout", () => {
    // The bug this guards against: navigation attributes were declared on the
    // section that WRAPS the page. htmx inherits hx-target/hx-swap/hx-push-url
    // into every descendant, so the chat's tail poll — sitting inside #main —
    // answered itself by replacing the whole page and pushing
    // `/agent/wk/events.html?offset=62` into the address bar.
    test("the container that holds the page owns no navigation", async () => {
        const ctx: any = await mkTestCtx();
        const html = await ctx.fns.ui.layout({ main: "<p>page</p>", title: "t" });

        const pageView = /<section id="page-view"[^>]*>/.exec(html)?.[0] ?? "";
        expect(pageView).not.toBe("");
        for (const attr of ["hx-target", "hx-swap", "hx-push-url", "hx-boost"]) {
            expect(pageView).not.toContain(attr);
        }
        expect(html).toContain('<main id="main"');
        expect(html).toContain("<p>page</p>");
    });

    test("navigation is the palette, not a tab strip", async () => {
        const ctx: any = await mkTestCtx();
        const html = await ctx.fns.ui.layout({ main: "", title: "t" });

        expect(html).toContain('id="nav-overlay"');
        expect(html).not.toContain('id="agents-rail"');
        // No agent rail or tabs: reaching a page goes through the global menu;
        // quick access is only a thin strip of pinned page icons.
        expect(html).toContain('id="quick-bar"');
        expect(html).toContain('id="quick-items"');
        expect(html).not.toContain('data-action="open-tab"');
    });
});
