import { afterEach, describe, expect, test } from "bun:test";
import api from "./api";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

describe("zulip.api local credentials", () => {
    test("uses encrypted local credentials without bootstrap provider", async () => {
        let auth = "";
        globalThis.fetch = (async (_url: any, init: any) => {
            auth = init.headers.Authorization;
            return Response.json({ result: "success", members: [] });
        }) as any;
        const ctx: any = { env: {}, state: {}, fns: {
            zulip: { creds: async () => ["work"] },
            secrets: { get: async () => JSON.stringify({ url: "https://zulip.example", email: "me@example.com", apiKey: "secret-key" }) },
        } };
        const result = await api(ctx, null, { path: "/users", instance: "work" });
        expect(result.result).toBe("success");
        expect(auth).toBe(`Basic ${btoa("me@example.com:secret-key")}`);
    });
});
