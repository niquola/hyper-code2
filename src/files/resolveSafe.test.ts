import { test, expect, describe } from "bun:test";
import { resolve } from "node:path";
import resolveSafe from "./resolveSafe";

const ctx = {} as Context;

describe("files.resolveSafe", () => {
    test("empty string → cwd root", () => {
        expect(resolveSafe(ctx, null, { path: "" })).toBe(process.cwd());
    });

    test("normal relative path resolves inside cwd", () => {
        expect(resolveSafe(ctx, null, { path: "src/agent" })).toBe(process.cwd() + "/src/agent");
    });

    // Workspace confinement was removed by request — resolveSafe is now just a
    // relative→absolute resolver; out-of-cwd paths resolve, not throw.
    test("parent traversal resolves (no longer rejected)", () => {
        expect(resolveSafe(ctx, null, { path: "../other" })).toBe(resolve(process.cwd(), "../other"));
        expect(resolveSafe(ctx, null, { path: "src/../../outside" })).toBe(resolve(process.cwd(), "../outside"));
    });

    test("absolute path outside cwd passes through (no throw)", () => {
        expect(resolveSafe(ctx, null, { path: "/etc/passwd" })).toBe("/etc/passwd");
    });

    test("absolute path inside cwd is OK", () => {
        expect(resolveSafe(ctx, null, { path: process.cwd() + "/src" })).toBe(process.cwd() + "/src");
    });
});
