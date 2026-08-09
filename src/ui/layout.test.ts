import { describe, expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";
import { reqCtx } from "../$test";

const agentRow = {
    id: "x",
    model: "codex:gpt-5.4",
    title: "(empty)",
    turns: 0,
    createdAt: 1,
    updatedAt: 1,
};

const mkCtx = async () => {
    const ctx: any = await mkTestCtx();
    ctx.state.registry.session.list = (_c: any, _s: any, _o: any) => [agentRow];
    ctx.state.registry.files.listOpen = (_c: any, _s: any, _o: any) => [];
    (ctx.state.agent ??= {}).x = { id: "x", isStreaming: false };
    return ctx;
};

describe("layout sidebar refresh", () => {
    test("returns sidebar fragment for arbitrary current route when x-hyper-fragment=sidebar", async () => {
        const ctx = await mkCtx();
        const req = new Request("http://localhost/agent/new", {
            headers: { "x-hyper-fragment": "sidebar" },
        });
        const rctx: any = reqCtx(ctx, { req });

        const html = rctx.fns.ui.layout({ title: "new agent", main: "<div>body</div>" }) as string;

        expect(html).toContain("<aside");
        expect(html).toContain("x");
        expect(html).not.toContain("<html");
    });

    test("without the fragment header renders the full document around main", async () => {
        const ctx = await mkCtx();
        const rctx: any = reqCtx(ctx, { req: new Request("http://localhost/agent/new") });

        const html = rctx.fns.ui.layout({ title: "new agent", main: "<div>body</div>" }) as string;

        expect(html).toContain("<html");
        expect(html).toContain("<aside");
        expect(html).toContain("<div>body</div>");
    });
});
