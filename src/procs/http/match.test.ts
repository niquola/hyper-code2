// UNIT test: src/http/match.test.ts ↔ src/http/match.ts (one function).
import { test, expect } from "bun:test";
import { testCtx } from "../../$test";

const ctx = await testCtx();

test("match: exact route, no params", () => {
    ctx.state.procs.http.routes = { "/a": { GET: () => 1 } };
    expect(ctx.fns.procs.http.match({ method: "GET", pathname: "/a" })).toMatchObject({ params: {} });
});

test("match: nested :param extraction", () => {
    ctx.state.procs.http.routes = { "/billing/invoices/:id": { GET: () => 1 } };
    expect(ctx.fns.procs.http.match({ method: "GET", pathname: "/billing/invoices/42" })?.params).toEqual({ id: "42" });
});

test("match: wrong method → null", () => {
    ctx.state.procs.http.routes = { "/a": { GET: () => 1 } };
    expect(ctx.fns.procs.http.match({ method: "POST", pathname: "/a" })).toBeNull();
});
