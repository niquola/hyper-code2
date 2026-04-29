import { test, expect, describe } from "bun:test";
import route from "./$route_$id_GET";
import layout from "../$layout";
import script from "../ui/script";
import renderEventHtml from "./renderEventHtml";

const mkCtx = (agents: Record<string, any> = {}) => ({
    state: { agent: agents },
    env: {},
    fns: { ui: { script }, agent: { renderEventHtml } },
    layout,
} as unknown as Context);

function req(id: string): any {
    const r = new Request(`http://x/agent/${id}`);
    (r as any).params = { id };
    return r;
}

async function render(ctx: Context, id: string): Promise<string> {
    const out: any = await route(ctx, null, req(id));
    if (out instanceof Response) throw new Error(`expected {main}, got Response ${out.status}`);
    return layout(ctx, out);
}

describe("GET /agent/:id", () => {
    test("404 when agent does not exist", async () => {
        const res = await route(mkCtx(), null, req("agent_nope"));
        expect(res instanceof Response).toBe(true);
        expect((res as Response).status).toBe(404);
    });

    test("renders chat page with sidebar and empty messages area", async () => {
        const agent = { id: "agent_abc", model: "test-model", events: [], isStreaming: false };
        const ctx = mkCtx({ agent_abc: agent });
        const html = await render(ctx, "agent_abc");
        expect(html).toContain("<html");
        expect(html).toContain("agent_abc");
        expect(html).toContain("test-model");
        expect(html).toContain('id="messages"');
        expect(html).toContain('id="form"');
        expect(html).toContain("/agent/agent_abc/stop");
        expect(html).toContain("/agent/agent_abc/fork");
        expect(html).toContain("/agent/agent_abc/delete");
        expect(html).toContain('src="/agent/chat.js"');
        expect(html).toContain("window.__init");
    });

    test("server-renders initial events into #messages (SSR)", async () => {
        const agent = {
            id: "agent_x",
            model: "m",
            events: [
                { type: "user", text: "hi", messageIdx: 0 },
                { type: "assistant", text: "hello", html: "<p>hello</p>", messageIdx: 1 },
            ],
            isStreaming: false,
        };
        const ctx = mkCtx({ agent_x: agent });
        const html = await render(ctx, "agent_x");
        // window.__init has the metadata, but events themselves live in #messages
        expect(html).toContain("window.__init");
        expect(html).toContain('"agentId":"agent_x"');
        // SSR'd user bubble (right-aligned, dark background)
        expect(html).toContain("justify-end");
        expect(html).toContain('data-delete-idx="0"');
        // SSR'd assistant bubble with the markdown-rendered inner HTML
        expect(html).toContain("justify-start");
        expect(html).toContain("<p>hello</p>");
    });

    test("highlights current agent in sidebar", async () => {
        const agent = { id: "agent_here", model: "m", events: [], isStreaming: false };
        const ctx = mkCtx({ agent_here: agent });
        const html = await render(ctx, "agent_here");
        expect(html).toContain("/agent/agent_here");
        expect(html).toContain("font-semibold");
    });
});
