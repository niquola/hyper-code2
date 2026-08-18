import { expect, test } from "bun:test";
import status from "./$route_status_GET";
import callTool from "./$route_tools_$name_call_POST";

const req = (path: string, init?: RequestInit) => new Request(`http://localhost${path}`, init);

test("external status requires scoped authorization", async () => {
    const ctx: any = { fns: { external: { authorize: async () => ({ ok: false, response: Response.json({ error: "denied" }, { status: 403 }) }) } } };
    expect((await status(ctx, null, { req: req("/external/status") })).status).toBe(403);
});

test("external tool route delegates only through tools.call", async () => {
    let called: any;
    const ctx: any = { fns: {
        external: { authorize: async () => ({ ok: true }) },
        tools: { call: async (opts: any) => (called = opts, { output: "ok", isError: false }) },
    } };
    const res = await callTool(ctx, null, {
        req: req("/external/tools/read/call", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: "README.md" }) }),
        params: { name: "read" },
    });
    expect(res.status).toBe(200);
    expect(called).toEqual({ name: "read", args: { path: "README.md" } });
});
