import { describe, expect, test } from "bun:test";

// Regression: Codex wraps the displayed device code in ANSI colour sequences.
// A parser using \b sees the preceding ANSI `m` as a word character and misses
// the code even though a terminal displays it normally.
describe("Codex device-code output parsing", () => {
    test("extracts a coloured one-time code printed by codex-rs", () => {
        const output = "2. Enter this one-time code\n   \x1b[94mVO1P-0E4AQ\x1b[0m\n";
        const clean = output.replace(/\x1b\[[0-9;]*m/g, "");
        expect(/([A-Z0-9]{4,5}-[A-Z0-9]{4,5})/.exec(clean)?.[1]).toBe("VO1P-0E4AQ");
    });
});
