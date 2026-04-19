import { test, expect, describe } from "bun:test";
import resolveSafe from "./resolveSafe";

const ctx = {} as Context;

describe("files.resolveSafe", () => {
    test("empty string → cwd root", () => {
        expect(resolveSafe(ctx, "")).toBe(process.cwd());
    });

    test("normal relative path resolves inside cwd", () => {
        expect(resolveSafe(ctx, "src/agent")).toBe(process.cwd() + "/src/agent");
    });

    test("path traversal is rejected", () => {
        expect(() => resolveSafe(ctx, "../other")).toThrow(/outside workspace/);
        expect(() => resolveSafe(ctx, "src/../../outside")).toThrow(/outside workspace/);
    });

    test("absolute paths outside cwd are rejected", () => {
        expect(() => resolveSafe(ctx, "/etc/passwd")).toThrow(/outside workspace/);
    });

    test("absolute path inside cwd is OK", () => {
        expect(resolveSafe(ctx, process.cwd() + "/src")).toBe(process.cwd() + "/src");
    });
});
