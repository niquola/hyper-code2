// FUNCTIONAL test: src/http.test.ts ↔ the src/http/ namespace.
// Tests REST end-to-end WITHOUT a server, via http.dispatch (match → handler →
// toResponse). No socket, no port.
import { test, expect } from "bun:test";
import { testCtx } from "../$test";

const ctx = await testCtx();

test("dispatch: unknown route → 404", async () => {
    expect((await ctx.fns.procs.http.dispatch({ url: "/nope" })).status).toBe(404);
});

test("middleware: prefix match, session mutation, short-circuit", async () => {
    ctx.state.procs.http.middleware = [
        { prefix: "/guard", segs: ["guard"], handler: (_c: Context, s: Session) => { s.checked = true; } },
        { prefix: "/guard/secret", segs: ["guard", "secret"], handler: () => new Response("no", { status: 401 }) },
    ];
    ctx.state.procs.http.routes["/guard/open"] = { GET: (_c: Context, s: Session) => ({ checked: s.checked }) };
    ctx.state.procs.http.routes["/guard/secret"] = { GET: () => ({ ok: true }) };
    expect(await (await ctx.fns.procs.http.dispatch({ url: "/guard/open" })).json()).toEqual({ checked: true });
    expect((await ctx.fns.procs.http.dispatch({ url: "/guard/secret" })).status).toBe(401); // short-circuited
    ctx.state.procs.http.middleware = [];
});

// Matching before running middleware makes an app unable to answer for a path it
// does not route — which is exactly what a proxy is. The manager fronts every
// workspace by Host, so `<workspace>.<domain>/git` has to reach its middleware
// even though the manager has no /git route; it used to 404 first.
test("middleware runs for a path with no route, and may answer it", async () => {
    ctx.state.procs.http.middleware = [
        { prefix: "", segs: [], handler: (_c: Context, _s: Session, o: any) =>
            new URL(o.req.url).pathname === "/somebody-elses" ? new Response("proxied", { status: 200 }) : undefined },
    ];
    const proxied = await ctx.fns.procs.http.dispatch({ url: "/somebody-elses" });
    expect([proxied.status, await proxied.text()]).toEqual([200, "proxied"]);
    // and a path it does not claim is still a 404, not a hang
    expect((await ctx.fns.procs.http.dispatch({ url: "/nothing-here" })).status).toBe(404);
    ctx.state.procs.http.middleware = [];
});

test("dispatch: a throwing handler → 500 (same contract as the real server)", async () => {
    ctx.state.procs.http.routes["/boom"] = { GET: () => { throw new Error("kaboom"); } };
    const res = await ctx.fns.procs.http.dispatch({ url: "/boom" });
    expect(res.status).toBe(500);
    expect(await res.text()).toContain("kaboom"); // dev/test exposes the message
    delete ctx.state.procs.http.routes["/boom"];
});

test("dispatch: :param + JSON body + JSON response", async () => {
    ctx.state.procs.http.routes["/echo/:id"] = {
        POST: async (_c: Context, s: Session, o: { req: Request }) => ({ id: s.params!.id, body: await o.req.json() }),
    };
    const res = await ctx.fns.procs.http.dispatch({ method: "POST", url: "/echo/42", body: { hi: 1 } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "42", body: { hi: 1 } });
});

// A layout of the second level. A host owns the window; a module several pages
// deep owns the navigation between its own pages, and shipping `<name>/pane.ts`
// is how it says so — the routes keep returning `{ title, main }` and the pane is
// applied in one place, to its own paths and nothing else's.
test("a module's pane dresses the main of its own routes, on both paths", async () => {
    (ctx.state.registry as any).chart = {
        pane: (_c: Context, _s: Session | null, o: any) => `<nav data-pane="chart">${o.path}</nav>${o.main}`,
    };
    ctx.state.procs.http.routes["/chart/42"] = { GET: () => ({ title: "42", main: "<p>the chart</p>" }) };
    ctx.state.procs.http.routes["/other"] = { GET: () => ({ title: "other", main: "<p>not ours</p>" }) };

    // the htmx fragment…
    const partial = await (await ctx.fns.procs.http.dispatch({ url: "/chart/42", headers: { "hx-request": "true" } })).text();
    expect(partial).toContain(`<nav data-pane="chart">/chart/42</nav><p>the chart</p>`);
    // …and the whole document, which the layout then wraps
    const whole = await (await ctx.fns.procs.http.dispatch({ url: "/chart/42", headers: { accept: "text/html" } })).text();
    expect(whole).toContain(`data-pane="chart"`);
    expect(whole).toContain("<p>the chart</p>");

    // Somebody else's route is untouched.
    expect(await (await ctx.fns.procs.http.dispatch({ url: "/other", headers: { "hx-request": "true" } })).text())
        .toBe("<p>not ours</p>");

    // A pane that throws is a page without its navigation, not a 500.
    (ctx.state.registry as any).chart.pane = () => { throw new Error("boom"); };
    expect(await (await ctx.fns.procs.http.dispatch({ url: "/chart/42", headers: { "hx-request": "true" } })).text())
        .toBe("<p>the chart</p>");
    delete (ctx.state.registry as any).chart;
});
