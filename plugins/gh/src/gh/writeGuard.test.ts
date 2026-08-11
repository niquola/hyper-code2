import { describe, expect, test } from "bun:test";
import api from "./api";
import comment from "./comment";
import createIssue from "./createIssue";

const ctx: any = {};

describe("GitHub write guards", () => {
    test("low-level non-GET requires confirmation before auth", async () => {
        await expect(api(ctx, null, { route: "DELETE /repos/o/r/issues/1" })).rejects.toThrow("confirm: true");
    });
    test("comment requires confirmation", async () => {
        await expect(comment(ctx, null, { owner: "o", repo: "r", n: 1, body: "x" })).rejects.toThrow("confirm: true");
    });
    test("createIssue requires confirmation", async () => {
        await expect(createIssue(ctx, null, { owner: "o", repo: "r", title: "x" })).rejects.toThrow("confirm: true");
    });
    test("route validation rejects external URLs", async () => {
        await expect(api(ctx, null, { route: "GET https://example.com" })).rejects.toThrow("route must be");
    });
});
