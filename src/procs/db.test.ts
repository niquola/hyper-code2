// FUNCTIONAL test: src/db.test.ts ↔ src/db/ namespace.
import { test, expect } from "bun:test";
import { testCtx } from "../$test";

const ctx = await testCtx();

test("db: test env resolves to :memory:", () => {
    expect(ctx.fns.procs.db.url()).toBe(":memory:");
});

test("db: exec / run / query round-trip", () => {
    ctx.fns.procs.db.exec({ sql: "CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)" });
    expect(ctx.fns.procs.db.run({ sql: "INSERT INTO t (v) VALUES (?)", params: ["hello"] }).changes).toBe(1);
    expect(ctx.fns.procs.db.select({ sql: "SELECT v FROM t" })).toEqual([{ v: "hello" }]);
});

test("db.sql: compiles the query DSL (parameterized)", () => {
    expect(ctx.fns.procs.db.sql({ select: ["id", "title"], from: "t", where: { done: 0, id: [1, 2] }, orderBy: "id", limit: 5 }))
        .toEqual({ sql: "SELECT id, title FROM t WHERE done = ? AND id IN (?, ?) ORDER BY id LIMIT 5", params: [0, 1, 2] });
});

test("db.sql: operator object — multiple ops AND-join, {} is a no-op", () => {
    expect(ctx.fns.procs.db.sql({ from: "t", where: { age: { ">": 1, "<": 10 } } }))
        .toEqual({ sql: "SELECT * FROM t WHERE age > ? AND age < ?", params: [1, 10] });
    expect(ctx.fns.procs.db.sql({ from: "t", where: { age: {} } }))
        .toEqual({ sql: "SELECT * FROM t", params: [] });
});

test("db.insert + db.q: round-trip through the DSL", () => {
    ctx.fns.procs.db.exec({ sql: "CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT, done INTEGER)" });
    ctx.fns.procs.db.insert({ into: "notes", values: { body: "hi", done: 0 } });
    ctx.fns.procs.db.insert({ into: "notes", values: { body: "yo", done: 1 } });
    expect(ctx.fns.procs.db.q({ select: "body", from: "notes", where: { done: 0 } })).toEqual([{ body: "hi" }]);
});

test("db lives in ctx → env.fork gives an isolated connection", () => {
    const a = ctx.fns.procs.env.fork({ mode: "test" });
    const b = ctx.fns.procs.env.fork({ mode: "test" });
    a.fns.procs.db.exec({ sql: "CREATE TABLE x (n INTEGER)" });
    a.fns.procs.db.run({ sql: "INSERT INTO x VALUES (1)" });
    b.fns.procs.db.exec({ sql: "CREATE TABLE x (n INTEGER)" });          // b has its OWN :memory:
    expect(b.fns.procs.db.select({ sql: "SELECT count(*) c FROM x" })).toEqual([{ c: 0 }]);
    expect(a.fns.procs.db.select({ sql: "SELECT count(*) c FROM x" })).toEqual([{ c: 1 }]);
});
