import { test, expect, describe } from "bun:test";
import resolveSafe from "./resolveSafe";

const ctx = {} as Context;

describe("files.resolveSafe", () => {
    test("empty string → cwd root", () => {
        expect(resolveSafe(ctx, { path: "" })).toBe(process.cwd());
    });

    test("normal relative path resolves inside cwd", () => {
        expect(resolveSafe(ctx, { path: "src/agent" })).toBe(process.cwd() + "/src/agent");
    });

    test("path traversal is rejected", () => {
        expect(() => resolveSafe(ctx, { path: "../other" })).toThrow(/outside workspace/);
        expect(() => resolveSafe(ctx, { path: "src/../../outside" })).toThrow(/outside workspace/);
    });

    test("absolute paths outside cwd are rejected", () => {
        expect(() => resolveSafe(ctx, { path: "/etc/passwd" })).toThrow(/outside workspace/);
    });

    test("absolute path inside cwd is OK", () => {
        expect(resolveSafe(ctx, { path: process.cwd() + "/src" })).toBe(process.cwd() + "/src");
    });
});
