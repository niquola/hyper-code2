import { test, expect, describe } from "bun:test";
import route from "./$route_$id_GET";
import layout from "../ui/layout";
import script from "../ui/script";

const mkCtx = (agents: Record<string, any> = {}) => ({
    state: { agent: agents },
    env: {},
    fns: { ui: { layout, script } },
} as unknown as Context);

function req(id: string): any {
    const r = new Request(`http://x/agent/${id}`);
    (r as any).params = { id };
    return r;
}

describe("GET /agent/:id", () => {
    test("404 when agent does not exist", async () => {
        const res = await route(mkCtx(), null, req("agent_nope"));
        expect(res.status).toBe(404);
    });

    test("renders chat page with sidebar and empty messages area", async () => {
        const agent = { id: "agent_abc", model: "test-model", events: [], isStreaming: false };
        const ctx = mkCtx({ agent_abc: agent });
        const res = await route(ctx, null, req("agent_abc"));
        expect(res.status).toBe(200);
        const html = await res.text();
        expect(html).toContain("<html");
        expect(html).toContain("agent_abc");
        expect(html).toContain("test-model");
        expect(html).toContain('id="messages"');
        expect(html).toContain('id="form"');
        expect(html).toContain("/agent/agent_abc/stop");
        expect(html).toContain("/agent/agent_abc/delete");
        expect(html).toContain('src="/agent/chat.js"');
        expect(html).toContain("window.__init");
    });

    test("seeds initial events into window.__init", async () => {
        const agent = {
            id: "agent_x",
            model: "m",
            events: [
                { type: "user", text: "hi" },
                { type: "assistant", text: "hello", html: "<p>hello</p>" },
            ],
            isStreaming: false,
        };
        const ctx = mkCtx({ agent_x: agent });
        const res = await route(ctx, null, req("agent_x"));
        const html = await res.text();
        expect(html).toContain("window.__init");
        expect(html).toContain('"user"');
        expect(html).toContain("hello");
        // XSS guard: '<' inside the JSON payload must be escaped to \u003c
        expect(html).toContain("\\u003cp>hello\\u003c/p>");
    });

    test("highlights current agent in sidebar", async () => {
        const agent = { id: "agent_here", model: "m", events: [], isStreaming: false };
        const ctx = mkCtx({ agent_here: agent });
        const res = await route(ctx, null, req("agent_here"));
        const html = await res.text();
        expect(html).toContain("/agent/agent_here");
        expect(html).toContain("font-semibold");
    });
});
