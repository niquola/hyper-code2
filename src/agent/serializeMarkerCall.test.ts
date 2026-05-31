import { describe, test, expect } from "bun:test";
import serializeMarkerCall from "./serializeMarkerCall";
import parseMarkersFn from "./parseMarkers";
import escapeMarkerBody from "./escapeMarkerBody";

const ctx = { fns: { agent: { escapeMarkerBody } } } as unknown as Context;
const parse = (text: string) => parseMarkersFn(null as any, { text });

describe("agent.serializeMarkerCall", () => {
    test("eval", () => {
        expect(serializeMarkerCall(ctx, { call: { kind: "eval", content: "1+1" } })).toBe("§eval\n1+1");
    });

    test("write includes path", () => {
        expect(serializeMarkerCall(ctx, { call: { kind: "write", path: "a.ts", content: "x" } })).toBe("§write:a.ts\nx");
    });

    test("html", () => {
        expect(serializeMarkerCall(ctx, { call: { kind: "html", content: "<b>hi</b>" } })).toBe("§html\n<b>hi</b>");
    });

    test("bash", () => {
        expect(serializeMarkerCall(ctx, { call: { kind: "bash", content: "ls" } })).toBe("§bash\nls");
    });

    test("read plain omits format suffix", () => {
        expect(serializeMarkerCall(ctx, { call: { kind: "read", path: "a.ts" } })).toBe("§read\na.ts");
    });

    test("read hashline includes format", () => {
        expect(serializeMarkerCall(ctx, { call: { kind: "read", path: "a.ts", format: "hashline" } })).toBe("§read:hashline\na.ts");
    });

    test("grep", () => {
        expect(serializeMarkerCall(ctx, { call: { kind: "grep", format: "plain", content: "pattern: x" } })).toBe("§grep\npattern: x");
    });

    test("edit", () => {
        expect(serializeMarkerCall(ctx, { call: { kind: "edit", content: "@a.ts" } })).toBe("§edit:hashline\n@a.ts");
    });
});

describe("agent.serializeMarkerCall — § escape round-trip", () => {
    // A body line that itself starts with a marker token must survive a
    // serialize → parse cycle as ONE call, not be re-split into two. Serialize
    // escapes such col-1 § as \§; parse's lookbehind ignores \§ then unescapes.
    test("body containing a line that starts with §eval round-trips losslessly", () => {
        const call = { kind: "eval" as const, content: "console.log('x')\n§eval\ninjected" };
        const wire = serializeMarkerCall(ctx, { call });
        // the inner col-1 § is escaped on the wire
        expect(wire).toBe("§eval\nconsole.log('x')\n\\§eval\ninjected");
        const r = parse(wire);
        expect(r.calls).toHaveLength(1);
        expect((r.calls[0] as any).content).toBe(call.content);
    });

    test("body with a bare § close line round-trips", () => {
        const call = { kind: "bash" as const, content: "echo a\n§\necho b" };
        const wire = serializeMarkerCall(ctx, { call });
        const r = parse(wire);
        expect(r.calls).toHaveLength(1);
        expect((r.calls[0] as any).content).toBe(call.content);
    });

    test("mid-line § is left untouched (not a marker, no escape noise)", () => {
        const call = { kind: "eval" as const, content: "const s = 'a § b';" };
        const wire = serializeMarkerCall(ctx, { call });
        expect(wire).toBe("§eval\nconst s = 'a § b';");
        expect((parse(wire).calls[0] as any).content).toBe(call.content);
    });
});
