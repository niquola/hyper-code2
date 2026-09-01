import { describe, expect, test } from "bun:test";
import api from "./api";

describe("pipedrive.api", () => {
    test("uses private settings and performs a GET request", async () => {
        const original = globalThis.fetch;
        let request: Request | undefined;
        globalThis.fetch = async (input: any, init?: any) => { request = new Request(input, init); return Response.json({ success: true, data: [{ id: 1 }] }); };
        try {
            const ctx: any = { fns: { secrets: { resolveSetting: async ({ key }: any) => key === "domain" ? "example" : "dummy-token-for-test" } } };
            const result = await api(ctx, null, { path: "/deals", params: { limit: 1 } });
            expect(result).toEqual([{ id: 1 }]);
            expect(request!.method).toBe("GET");
            expect(request!.url).toContain("https://example.pipedrive.com/api/v1/deals");
            expect(request!.url).toContain("api_token=dummy-token-for-test");
        } finally { globalThis.fetch = original; }
    });

    test("rejects unsafe paths before reading credentials", async () => {
        await expect(api({} as any, null, { path: "../users" })).rejects.toThrow("safe API path");
    });
});
