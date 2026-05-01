import { test, expect, describe } from "bun:test";
import route from "./$route_GET";
import layout from "./$layout";

const mkCtx = (agents: Record<string, any> = {}) => ({
    state: { agent: agents },
    env: {},
    fns: {},
    layout,
} as unknown as Context);

describe("GET /", () => {
    test("no agents — returns {main} with '+ new agent' link", async () => {
        const out: any = await route(mkCtx(), null, new Request("http://x/"));
        expect(out instanceof Response).toBe(false);
        const html = layout(mkCtx(), out);
        expect(html).toContain("<html");
        expect(html).toContain("/agent/new");
        expect(html).toContain("no agents");
    });

    test("agents exist — redirects 302 to /agent/<first-id>", async () => {
        const ctx = mkCtx({
            aaa: { id: "aaa", model: "m", events: [], isStreaming: false },
        });
        const res = await route(ctx, null, new Request("http://x/"));
        expect(res instanceof Response).toBe(true);
        expect((res as Response).status).toBe(302);
        expect((res as Response).headers.get("location")).toBe("/agent/aaa");
    });
});
