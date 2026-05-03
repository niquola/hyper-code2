import { describe, expect, test } from "bun:test";
import mermaid, { injectClassDefs } from "./mermaid";

describe("markdown.mermaid", () => {
    test("injectClassDefs injects palette class defs", () => {
        const code = ["flowchart LR", "A(Foo):::blue2 --> B(Bar)", "class B red1"].join("\n");
        const result = injectClassDefs(code);
        expect(result).toContain("classDef blue2 fill:#eff6ff,stroke:#7DA1EF,stroke-width:2px");
        expect(result).toContain("classDef red1 fill:#fef2f2,stroke:#F58685,stroke-width:1px");
    });

    test("injectClassDefs does not duplicate existing classDef", () => {
        const code = ["flowchart LR", "classDef blue2 fill:#custom,stroke:#custom", "class A blue2"].join("\n");
        const result = injectClassDefs(code);
        expect(result.match(/classDef blue2/g)).toHaveLength(1);
    });

    test("render returns mermaid html wrapper", async () => {
        const html = await mermaid({} as Context, { source: "flowchart LR\nA --> B" });
        expect(html).toContain("class=\"mermaid-diagram\"");
        expect(html).toContain("<svg");
    }, 20000);

    test("render strips google font imports", async () => {
        const html = await mermaid({} as Context, { source: "flowchart LR\nA --> B" });
        expect(html).not.toContain("fonts.googleapis.com");
        expect(html).not.toContain("@import");
    }, 20000);
});
