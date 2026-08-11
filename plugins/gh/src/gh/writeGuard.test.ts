import { describe, expect, test } from "bun:test";
import api from "./api";
import comment from "./comment";
import createIssue from "./createIssue";
import createPr from "./createPr";
import merge from "./merge";
import requestReviewers from "./requestReviewers";
import review from "./review";
import updateIssue from "./updateIssue";
import updatePr from "./updatePr";

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
    test("all additional write helpers require confirmation", async () => {
        await expect(createPr(ctx, null, { owner: "o", repo: "r", title: "x", head: "h", base: "b" })).rejects.toThrow("confirm: true");
        await expect(updateIssue(ctx, null, { owner: "o", repo: "r", n: 1, state: "closed" })).rejects.toThrow("confirm: true");
        await expect(updatePr(ctx, null, { owner: "o", repo: "r", n: 1, state: "closed" })).rejects.toThrow("confirm: true");
        await expect(requestReviewers(ctx, null, { owner: "o", repo: "r", n: 1, reviewers: ["u"] })).rejects.toThrow("confirm: true");
        await expect(review(ctx, null, { owner: "o", repo: "r", n: 1, event: "APPROVE" })).rejects.toThrow("confirm: true");
        await expect(merge(ctx, null, { owner: "o", repo: "r", n: 1 })).rejects.toThrow("confirm: true");
    });
    test("route validation rejects external URLs", async () => {
        await expect(api(ctx, null, { route: "GET https://example.com" })).rejects.toThrow("route must be");
    });
});
