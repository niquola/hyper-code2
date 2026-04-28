import { test, expect, describe } from "bun:test";
import genTypes from "./genTypes";
import roots from "./project/roots";
import scan from "./project/scan";

describe("genTypes", () => {
    test("scans src and writes ctx_ns.d.ts", async () => {
        const ctx = { fns: { project: { roots, scan } } } as unknown as Context;
        const stats = await genTypes(ctx);
        expect(stats.roots).toBeGreaterThan(0);
        expect(stats.modules).toBeGreaterThan(0);
        expect(stats.types).toBeGreaterThan(0);

        const content = await Bun.file("src/ctx_ns.d.ts").text();
        expect(content).toContain("declare global");
        expect(content).toContain("interface FnsRegistry");
        expect(content).toContain("interface RootFns");
        expect(content).toContain("namespace types");
        expect(content).toContain("namespace agent");
        expect(content).toContain("type Context");
    });
});
