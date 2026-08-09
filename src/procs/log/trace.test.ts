// FUNCTIONAL test: a log line inherits the call it happens inside.
// Nobody passes a request id anywhere — the session already flows down every
// ctx.fns call, so the trace comes with it.
import { test, expect } from "bun:test";
import { testCtx } from "../../$test";

const ctx = await testCtx();
ctx.state.procs.log = { level: 3, format: "json", service: "test-app" };

function captured(fn: () => any): any[] {
    const lines: any[] = [];
    const write = process.stdout.write.bind(process.stdout);
    (process.stdout as any).write = (s: string) => { try { lines.push(JSON.parse(s)); } catch { /* not ours */ } return true; };
    try { fn(); } finally { (process.stdout as any).write = write; }
    return lines;
}

test("a request mints one trace, and every line inside it carries the same id", async () => {
    ctx.state.procs.http.routes["/traced/:id"] = {
        GET: (c: Context) => { c.fns.procs.log.info({ event: "inner", msg: "deep" }); return { ok: true }; },
    };
    let lines: any[] = [];
    const write = process.stdout.write.bind(process.stdout);
    (process.stdout as any).write = (s: string) => { try { lines.push(JSON.parse(s)); } catch { /* not ours */ } return true; };
    try { await ctx.fns.procs.http.dispatch({ url: "/traced/42" }); } finally { (process.stdout as any).write = write; }
    delete ctx.state.procs.http.routes["/traced/:id"];

    const line = lines.find(l => l.Attributes?.event === "inner");
    expect(line).toBeDefined();
    expect(line.TraceId).toMatch(/^[0-9a-f]{8}$/);
    expect(line.Attributes["trace.id"]).toBe(line.TraceId);
    // The PATTERN, not the url — that is what you group by.
    expect(line.Attributes["http.route"]).toBe("/traced/:id");
    expect(line.Attributes["http.url"]).toBe("/traced/42");
    expect(line.Attributes["http.method"]).toBe("GET");
});

test("outside a request there is no trace, and nothing pretends there is", () => {
    const [line] = captured(() => ctx.fns.procs.log.info({ event: "bare", msg: "no session" }));
    expect(line.Attributes.event).toBe("bare");
    expect(line.TraceId).toBeUndefined();
    expect(line.Attributes["trace.id"]).toBeUndefined();
});

test("before log/$start has run the gate falls back to the environment", () => {
    // Boot logs through the same logger, and at that point there is no state:
    // the level and format come from env instead of from silence.
    const saved = ctx.state.procs.log;
    const savedLevel = ctx.env.LOG_LEVEL;
    (ctx.state.procs as any).log = undefined;
    ctx.env.LOG_FORMAT = "json";

    ctx.env.LOG_LEVEL = "info";
    expect(captured(() => ctx.fns.procs.log.info({ event: "early", msg: "during boot" }))[0]?.Attributes.event).toBe("early");

    ctx.env.LOG_LEVEL = "warn";
    expect(captured(() => ctx.fns.procs.log.info({ event: "early", msg: "during boot" }))).toEqual([]);

    delete ctx.env.LOG_FORMAT;
    ctx.env.LOG_LEVEL = savedLevel!;
    ctx.state.procs.log = saved;
});
