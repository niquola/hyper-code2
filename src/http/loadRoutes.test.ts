import { test, expect, describe } from "bun:test";
import loadRoutes from "./loadRoutes";

describe("http.loadRoutes", () => {
    test("scans src and populates ctx.routes", async () => {
        const ctx = { routes: {} } as unknown as Context;
        const result = await loadRoutes(ctx);
        expect(result).toBe(ctx.routes);
        expect(ctx.routes["/"]?.GET).toBeTypeOf("function");
        expect(ctx.routes["/repl"]?.POST).toBeTypeOf("function");
    });

    test("is idempotent — second call does not duplicate", async () => {
        const ctx = { routes: {} } as unknown as Context;
        await loadRoutes(ctx);
        const firstKeys = Object.keys(ctx.routes).sort();
        await loadRoutes(ctx);
        expect(Object.keys(ctx.routes).sort()).toEqual(firstKeys);
    });
});
