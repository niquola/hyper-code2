// UNIT test: src/loadFns.test.ts ↔ src/loadFns.ts (the exported helpers).
import { test, expect } from "bun:test";
import { dottedName, setPath } from "./boot/load";

test("dottedName: nested module → dotted path", () => {
    expect(dottedName({ moduleDir: "billing/invoices", runtimeName: "create" })).toBe("billing.invoices.create");
    expect(dottedName({ moduleDir: "math", runtimeName: "fib" })).toBe("math.fib");
});

test("dottedName: root $name.ts (moduleDir '.') → bare name, NOT '..name'", () => {
    // Regression: dev.def used to build "." -> ".".replaceAll + "." + name = "..genTypes",
    // which repl.load could not resolve, so def threw for every root fn.
    expect(dottedName({ moduleDir: ".", runtimeName: "genTypes" })).toBe("genTypes");
});

test("setPath: creates intermediate objects", () => {
    const root: any = {};
    setPath(root, ["a", "b", "c"], 42);
    expect(root.a.b.c).toBe(42);
});
