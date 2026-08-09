// FUNCTIONAL test: src/config.test.ts ↔ the src/config/ namespace.
import { test, expect } from "bun:test";
import { testCtx } from "../$test";

const ctx = await testCtx();

test("config.coerce: types + defaults", () => {
    const schema: ConfigSchema = { port: { type: "integer", default: 3000 }, tags: { type: "string[]" }, on: { type: "boolean" } };
    expect(ctx.fns.procs.config.coerce({ schema, config: { port: "8080", tags: "a, b", on: "true" } }))
        .toEqual({ port: 8080, tags: ["a", "b"], on: true });
    expect(ctx.fns.procs.config.coerce({ schema, config: {} }).port).toBe(3000); // default applied
});

test("config.validate: required + type errors", () => {
    const schema: ConfigSchema = { host: { type: "string", required: true }, port: { type: "integer" } };
    expect(ctx.fns.procs.config.validate({ schema, config: { host: "x", port: 5 } })).toEqual([]);
    expect(ctx.fns.procs.config.validate({ schema, config: { port: "nope" } }).length).toBeGreaterThan(0); // missing host + bad port
});

test("config.resolve: env enters through config (DATABASE_URL → url)", () => {
    // testCtx no longer pins DATABASE_URL (the url stays the real Postgres) —
    // set it explicitly on a fork to show env entering through config.
    const c = ctx.fns.procs.env.fork({ mode: "test", env: { DATABASE_URL: "postgres://cfg:cfg@localhost:5432/cfg" } });
    const schema: ConfigSchema = { url: { type: "string", required: true, env: "DATABASE_URL" } };
    expect(c.fns.procs.config.resolve({ module: "db", schema }).url).toBe("postgres://cfg:cfg@localhost:5432/cfg");
});

test("config.resolve: invalid config throws", () => {
    const schema: ConfigSchema = { n: { type: "integer", required: true } };
    expect(() => ctx.fns.procs.config.resolve({ module: "nope_module", schema })).toThrow();
});
