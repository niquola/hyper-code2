import { describe, expect, test } from "bun:test";
import creds from "./creds";

describe("zulip.creds", () => {
    test("returns only configured instance names from cache", async () => {
        const sentinel = "not-a-real-credential";
        const ctx: any = { env: {}, state: { zulip: { creds: { fhir: { apiKey: sentinel } }, instances: ["connect", "fhir", "hs"] } } };
        const result = await creds(ctx, null, { list: true });
        expect(result).toEqual(["connect", "fhir", "hs"]);
        expect(JSON.stringify(result)).not.toContain(sentinel);
    });
});
