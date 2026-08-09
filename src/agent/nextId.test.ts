import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import nextId from "./nextId";

function mkCtx() {
    const db = new Database(':memory:');
    db.exec('CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);');
    // Plain-object ctx (no injecting Proxy) — stubs receive opts directly.
    return {
        state: { db },
        fns: {
            procs: {
                db: {
                    select: (opts: { sql: string; params?: any }) => {
                        const params = opts.params;
                        const q = db.query(opts.sql);
                        return Array.isArray(params) ? q.all(...params) : q.all(params ?? []);
                    },
                    run: (opts: { sql: string; params?: any }) => {
                        const params = opts.params;
                        const stmt = db.prepare(opts.sql);
                        const res = Array.isArray(params) ? stmt.run(...params) : stmt.run(params ?? []);
                        return { changes: res.changes ?? 0, lastInsertRowid: res.lastInsertRowid ?? 0 };
                    },
                },
            },
        },
    } as any;
}

describe('agent.nextId', () => {
    test('generates a, b, ... z, aa, ab', () => {
        const ctx = mkCtx();
        const ids = Array.from({ length: 28 }, () => nextId(ctx, null));
        expect(ids.slice(0, 5)).toEqual(['a', 'b', 'c', 'd', 'e']);
        expect(ids[25]).toBe('z');
        expect(ids[26]).toBe('aa');
        expect(ids[27]).toBe('ab');
    });
});
