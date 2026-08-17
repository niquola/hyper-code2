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

    test("initializes and exposes a persisted light-dark theme switcher", async () => {
        const ctx: any = await mkTestCtx();
        const html = await ctx.fns.ui.layout({ main: "", title: "t" });
        expect(html).toContain("localStorage.getItem('hyper-theme')");
        expect(html).toContain("prefers-color-scheme: dark");
        expect(html).toContain('id="theme-toggle"');
        expect(html).toContain("localStorage.setItem('hyper-theme',next)");
        expect(html).toContain('class="bg-base-200 text-base-content text-sm h-screen"');
    });

    test("provides one reusable dotted surface for chat and content pages", async () => {
        const ctx: any = await mkTestCtx();
        const html = await ctx.fns.ui.layout({ main: "", title: "t" });
        expect(html).toContain(".dot-grid-surface {");
        expect(html).toContain("background-image: radial-gradient");
    });



    test("embed mode renders only the page surface for iframe previews", async () => {
        const ctx: any = await mkTestCtx();
        const session: any = { url: new URL("http://localhost/files/absolute/tmp/readme.md?embed=1"), req: new Request("http://localhost/files/absolute/tmp/readme.md?embed=1") };
        const html = await ctx.state.registry.ui.layout(ctx, session, { main: "<p>embedded</p>", title: "file" });
        expect(html).toContain("<p>embedded</p>");
        expect(html).not.toContain('id="quick-bar"');
        expect(html).not.toContain('id="app-popup"');
        expect(html).not.toContain('id="nav-overlay"');
        expect(html).toContain("window.parent.postMessage({type:'ui.close-popup'}");
    });


    test("host layout closes its popup when an embedded Files frame sends Escape", async () => {
        const ctx: any = await mkTestCtx();
        const html = await ctx.fns.ui.layout({ main: "", title: "t" });
        expect(html).toContain("event.data?.type!=='ui.close-popup'");
        expect(html).toContain("dialog.close()");
    });

});
