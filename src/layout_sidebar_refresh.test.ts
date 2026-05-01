import { describe, expect, test, mock } from "bun:test";
import layout from "./$layout";

describe("layout sidebar refresh", () => {
    test("returns sidebar fragment for arbitrary current route when x-hyper-fragment=sidebar", () => {
        const list = mock(() => [{
            id: "x",
            model: "codex:gpt-5.4",
            title: "(empty)",
            turns: 0,
            createdAt: 1,
            updatedAt: 1,
        }]);

        const ctx = {
            state: { agent: { x: { id: "x", isStreaming: false } } },
            fns: {
                session: { list },
                files: { listOpen: () => [] },
            },
        } as unknown as Context;

        const req = new Request("http://localhost/agent/new", {
            headers: { "x-hyper-fragment": "sidebar" },
        });

        const html = layout(ctx, {
            title: "new agent",
            main: "<div>body</div>",
        }, req) as string;

        expect(html).toContain("<aside");
        expect(html).toContain("x");
    });
});
