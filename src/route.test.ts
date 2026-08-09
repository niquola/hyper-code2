import { test, expect, describe } from "bun:test";
import { mkTestCtx } from "./_testCtx.entry";

describe("GET /", () => {
    test("no agents — renders page with '+ new agent' link", async () => {
        const ctx = await mkTestCtx();
        const res = await ctx.fns.procs.http.dispatch({ url: "/" });
        expect(res.status).toBe(200);
        const html = await res.text();
        expect(html).toContain("/agent/new");
        expect(html.toLowerCase()).toContain("no agents");
    });

    test("agents exist — redirects 302 to /agent/<first-id>", async () => {
        const ctx = await mkTestCtx();
        (ctx.state as any).agent = {
            aaa: { id: "aaa", model: "m", events: [], isStreaming: false },
        };
        const res = await ctx.fns.procs.http.dispatch({ url: "/" });
        expect(res.status).toBe(302);
        expect(res.headers.get("location")).toBe("/agent/aaa");
    });
});
