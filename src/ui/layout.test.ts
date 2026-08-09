import { describe, expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";
import { reqCtx } from "../$test";

describe("layout (workspace frame)", () => {
    test("renders chat column for the current agent + page main + tab bar", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:echo" });
        await ctx.fns.session.save({ agent });
        const rctx: any = reqCtx(ctx, { req: new Request("http://localhost/search") });

        const html = await rctx.fns.ui.layout({ currentId: agent.id, title: "search", main: "<div>page-body</div>" }) as string;

        expect(html).toContain("<html");
        expect(html).toContain('id="chat-panel"');       // chat column on the left
        expect(html).toContain('id="messages"');         // transcript inside it
        expect(html).toContain("<div>page-body</div>");  // route main on the right
        expect(html).toContain('href="/search"');        // tab bar
        expect(html).toContain('id="nav-overlay"');      // ⌘K palette island
        expect(html).toContain(`data-agent-id="${agent.id}"`);
    });

    test("no agents at all — offers + new agent instead of a chat", async () => {
        const ctx: any = await mkTestCtx();
        const rctx: any = reqCtx(ctx, { req: new Request("http://localhost/") });
        const html = await rctx.fns.ui.layout({ main: "<div>hi</div>" }) as string;
        expect(html).toContain("/agent/new");
        expect(html).not.toContain('id="messages"');
    });

    test("sticky current agent survives pages that pass no currentId", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:echo" });
        await ctx.fns.session.save({ agent });
        const rctx: any = reqCtx(ctx, { req: new Request("http://localhost/agent/x") });
        await rctx.fns.ui.layout({ currentId: agent.id, main: "" });   // visit sets sticky
        const html = await rctx.fns.ui.layout({ main: "<div>other page</div>" }) as string;
        expect(html).toContain(`data-agent-id="${agent.id}"`);
        expect(html).toContain('id="messages"');
    });
});
