import { expect, test } from "bun:test";
import middleware from "../$middleware";

function context(configured: string | null, authenticated = false): any {
    return { fns: {
        auth: { password: async () => configured },
        procs: { auth: { authenticate: async () => authenticated ? ({ sub: "u", name: "User" }) : null } },
    }, state: {} };
}

test("password gate redirects HTML and rejects JSON", async () => {
    const html = await middleware(context("secret"), null, { req: new Request("https://hyper.example/agent/ab", { headers: { accept: "text/html" } }) });
    expect(html?.status).toBe(303);
    expect(html?.headers.get("location")).toBe("/auth/login?next=%2Fagent%2Fab");
    const api = await middleware(context("secret"), null, { req: new Request("https://hyper.example/api/mobile/v1/agents", { headers: { accept: "application/json" } }) });
    expect(api?.status).toBe(401);
});

test("disabled auth leaves existing local behavior unchanged", async () => {
    expect(await middleware(context(null), null, { req: new Request("http://localhost/agent/ab") })).toBeUndefined();
});

test("authenticated cross-origin writes are rejected", async () => {
    const response = await middleware(context("secret", true), null, { req: new Request("https://hyper.example/api/mobile/v1/agents/ab/stop", { method: "POST", headers: { origin: "https://evil.example", host: "hyper.example" } }) });
    expect(response?.status).toBe(403);
});
