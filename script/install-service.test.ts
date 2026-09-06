import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("./install-service.sh", import.meta.url), "utf8");

describe("install-service", () => {
    test("refuses to kill an unrelated listener", () => {
        expect(script).toContain('if [ "$cwd" != "$ROOT" ]');
        expect(script).toContain("ничего не останавливаю");
    });

    test("fails installation when readiness never arrives", () => {
        expect(script).toContain('if [ "$ready" -ne 1 ]');
        expect(script).toContain('exit 1');
    });

    test("runs through the bounded-log wrapper", () => {
        expect(script).toContain("script/run-service.ts");
        expect(script).toContain("service.error.log");
    });
});
