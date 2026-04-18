import { test, expect } from "bun:test";
import route from "./$route_GET";

test("GET / returns index.html", async () => {
    const ctx = {} as Context;
    const req = new Request("http://x/");
    const res = await route(ctx, null, req);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("<html");
});
