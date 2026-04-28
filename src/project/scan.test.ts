import { describe, test, expect } from "bun:test";
import roots from "./roots";
import scan from "./scan";

describe("project.scan", () => {
    test("returns src root and discovered entries", async () => {
        const ctx = { fns: { project: { roots } } } as unknown as Context;
        const rs = await roots(ctx);
        expect(rs.find(r => r.name === 'src')).toBeTruthy();
        const entries = await scan(ctx);
        expect(entries.some(e => e.kind === 'fn' && e.rel === 'loadFns.ts')).toBe(true);
        expect(entries.some(e => e.kind === 'route' && e.routePath === '/')).toBe(true);
        expect(entries.some(e => e.kind === 'type' && e.rel === '$type_Context.ts')).toBe(true);
    });
});
