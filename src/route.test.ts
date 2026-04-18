import { test, expect, describe } from "bun:test";
import route from "./$route_GET";
import layout from "./ui/layout";

const mkCtx = (agents: Record<string, any> = {}) => ({
    state: { agent: agents },
    env: {},
    fns: { ui: { layout } },
} as unknown as Context);

describe("GET /", () => {
    test("no agents — returns HTML with '+ new agent' link", async () => {
        const res = await route(mkCtx(), null, new Request("http://x/"));
        expect(res.status).toBe(200);
        const html = await res.text();
        expect(html).toContain("<html");
        expect(html).toContain("/agent/new");
        expect(html).toContain("no agents");
    });

    test("agents exist — redirects 302 to /agent/<first-id>", async () => {
        const ctx = mkCtx({
            agent_aaa: { id: "agent_aaa", model: "m", events: [], isStreaming: false },
        });
        const res = await route(ctx, null, new Request("http://x/"));
        expect(res.status).toBe(302);
        expect(res.headers.get("location")).toBe("/agent/agent_aaa");
    });
});
