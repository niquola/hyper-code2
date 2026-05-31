import { describe, test, expect } from "bun:test";
import escapeMarkerBody from "./escapeMarkerBody";

const ctx = {} as Context;
const esc = (body: string) => escapeMarkerBody(ctx, { body });

describe("agent.escapeMarkerBody", () => {
    test("escapes a § at column 1 (start of string)", () => {
        expect(esc("§eval\nx")).toBe("\\§eval\nx");
    });

    test("escapes a § at the start of an interior line", () => {
        expect(esc("a\n§bash\nb")).toBe("a\n\\§bash\nb");
    });

    test("escapes a bare § close line", () => {
        expect(esc("a\n§\nb")).toBe("a\n\\§\nb");
    });

    test("leaves mid-line § untouched (not structural)", () => {
        expect(esc("const s = 'a § b';")).toBe("const s = 'a § b';");
    });

    test("is idempotent — already-escaped \\§ is not doubled", () => {
        const once = esc("§eval\nx");
        expect(esc(once)).toBe(once);
    });

    test("escapes every col-1 occurrence", () => {
        expect(esc("§a\n§b\nmid § stays\n§c")).toBe("\\§a\n\\§b\nmid § stays\n\\§c");
    });

    test("empty / null body is safe", () => {
        expect(esc("")).toBe("");
        expect(escapeMarkerBody(ctx, { body: null as any })).toBe("");
    });
});
