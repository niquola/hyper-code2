// FUNCTIONAL test: src/log.test.ts ↔ src/log/ namespace.
// Tests level gating, pretty/json output, per-ctx isolation via fork.
import { test, expect } from "bun:test";
import { testCtx } from "../$test";

const ctx = await testCtx();

// Init log state (lifecycle doesn't run in testCtx)
ctx.state.procs.log = { level: 2, format: "pretty", service: "test-app" };

test("log.level: get returns current level", () => {
    expect(ctx.fns.procs.log.level({})).toEqual({ level: 2, name: "info" });
});

test("log.level: set changes the level", () => {
    ctx.fns.procs.log.level({ set: "debug" });
    expect(ctx.fns.procs.log.level({})).toEqual({ level: 3, name: "debug" });
    ctx.fns.procs.log.level({ set: "info" }); // restore
});

test("log.level: set by number", () => {
    ctx.fns.procs.log.level({ set: 0 });
    expect(ctx.fns.procs.log.level({})).toEqual({ level: 0, name: "error" });
    ctx.fns.procs.log.level({ set: "info" }); // restore
});

test("log: level gate — debug filtered at info level", () => {
    // At info level (2), debug (3) should not emit.
    // We verify by switching to json and capturing stdout.
    const chunks: string[] = [];
    const origWrite = process.stdout.write;
    process.stdout.write = ((chunk: any) => { chunks.push(String(chunk)); return true; }) as any;
    try {
        ctx.state.procs.log.format = "json";
        ctx.fns.procs.log.debug({ event: "filtered", msg: "should not appear" });
        expect(chunks).toEqual([]); // nothing emitted
        ctx.fns.procs.log.info({ event: "passes", msg: "visible" });
        expect(chunks.length).toBe(1);
    } finally {
        process.stdout.write = origWrite;
        ctx.state.procs.log.format = "pretty";
    }
});

test("log: json output is OTel-compatible", () => {
    const chunks: string[] = [];
    const origWrite = process.stdout.write;
    process.stdout.write = ((chunk: any) => { chunks.push(String(chunk)); return true; }) as any;
    try {
        ctx.state.procs.log.format = "json";
        ctx.fns.procs.log.warn({ event: "db.slow", msg: "Query took 5s", table: "users", ms: 5000 });
        expect(chunks.length).toBe(1);
        const record = JSON.parse(chunks[0]!);
        expect(record.SeverityNumber).toBe(13);     // OTel WARN
        expect(record.SeverityText).toBe("WARN");
        expect(record.Body).toBe("Query took 5s");
        expect(record.Attributes.event).toBe("db.slow");
        expect(record.Attributes.table).toBe("users");
        expect(record.Attributes.ms).toBe(5000);
        expect(record.Resource["service.name"]).toBe("test-app");
        expect(record.Timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    } finally {
        process.stdout.write = origWrite;
        ctx.state.procs.log.format = "pretty";
    }
});

test("log: error emits at any level except off", () => {
    const chunks: string[] = [];
    const origWrite = process.stdout.write;
    process.stdout.write = ((chunk: any) => { chunks.push(String(chunk)); return true; }) as any;
    try {
        ctx.state.procs.log.format = "json";
        ctx.fns.procs.log.level({ set: "error" });
        ctx.fns.procs.log.info({ event: "x" });   // filtered
        ctx.fns.procs.log.error({ event: "y" });   // passes
        expect(chunks.length).toBe(1);
        expect(JSON.parse(chunks[0]!).SeverityText).toBe("ERROR");

        chunks.length = 0;
        ctx.fns.procs.log.level({ set: "off" });
        ctx.fns.procs.log.error({ event: "z" });   // filtered — off
        expect(chunks).toEqual([]);
    } finally {
        process.stdout.write = origWrite;
        ctx.state.procs.log.format = "pretty";
        ctx.fns.procs.log.level({ set: "info" });
    }
});

test("log: fork gets isolated log state", () => {
    const fork = ctx.fns.procs.env.fork({ mode: "test" });
    fork.fns.procs.log.level({ set: "debug" });
    expect(fork.fns.procs.log.level({})).toEqual({ level: 3, name: "debug" });
    expect(ctx.fns.procs.log.level({})).toEqual({ level: 2, name: "info" }); // parent untouched
});
