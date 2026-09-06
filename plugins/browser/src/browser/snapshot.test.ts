import { expect, test } from "bun:test";
import snapshot from "./snapshot";

function context(nodes: any[], page: any = { title: "Example", url: "https://example.test", text: "Hello\nWorld" }) {
    const normalizedPage = "content" in page ? page : { ...page, content: page.text ?? "" };
    return {
        state: {},
        fns: {
            browser: {
                evaluate: async () => normalizedPage,
            },
            cdp: { scope: async (opts: any) => ({ ...opts, bound: false }),
                send: async ({ method }: any) => {
                    if (method === "Page.getFrameTree") return { frameTree: { frame: { id: "frame-1", loaderId: "loader-1" } } };
                    if (method === "Accessibility.enable") return {};
                    if (method === "Accessibility.getFullAXTree") return { nodes };
                    throw new Error(`unexpected CDP method ${method}`);
                },
            },
        },
    } as unknown as Context;
}

const nodes = [
    { nodeId: "1", role: { value: "RootWebArea" }, name: { value: "Example" }, backendDOMNodeId: 1, childIds: ["2", "3"] },
    { nodeId: "2", parentId: "1", role: { value: "heading" }, name: { value: "Welcome" }, backendDOMNodeId: 2, properties: [{ name: "level", value: { value: 1 } }] },
    { nodeId: "3", parentId: "1", role: { value: "button" }, name: { value: "Save" }, backendDOMNodeId: 3, properties: [{ name: "focusable", value: { value: true } }] },
];

test("interactive snapshot returns compact revision-scoped refs", async () => {
    const ctx = context(nodes);
    const result = await snapshot(ctx, null, { mode: "interactive" });
    expect(result.revision).toBe("r1");
    expect(result.content).toContain('@r1e1 [heading] "Welcome" level=1');
    expect(result.content).toContain('@r1e2 [button] "Save"');
    expect(result.returnedNodes).toBe(2);
    expect(result.truncated).toBe(false);
});

test("text snapshot enforces output bounds", async () => {
    const ctx = context([], { title: "Text", url: "https://text.test", text: `${"a".repeat(490)}\n${"b".repeat(20)}` });
    const result = await snapshot(ctx, null, { mode: "text", maxChars: 500 });
    expect(result.content).toBe(`${"a".repeat(490)}\n${"b".repeat(9)}`);
    expect(result.truncated).toBe(true);
    expect(result.totalNodes).toBe(2);
});

test("explicit sinceRevision returns structural changes", async () => {
    const ctx = context(nodes);
    const first = await snapshot(ctx, null, {});
    const changedNodes = nodes.map(node => node.nodeId === "3" ? { ...node, name: { value: "Saved" } } : node);
    (ctx.fns.cdp.send as any) = async ({ method }: any) => {
        if (method === "Page.getFrameTree") return { frameTree: { frame: { id: "frame-1", loaderId: "loader-1" } } };
        if (method === "Accessibility.enable") return {};
        if (method === "Accessibility.getFullAXTree") return { nodes: changedNodes };
        throw new Error(`unexpected CDP method ${method}`);
    };
    const second = await snapshot(ctx, null, { sinceRevision: first.revision });
    expect(second.revision).toBe("r2");
    expect(second.changes?.changed).toHaveLength(1);
    expect(second.changes?.changed[0].before).toContain("Save");
    expect(second.changes?.changed[0].after).toContain("Saved");
});



test("markdown and html modes use the readable snapshot extraction", async () => {
    for (const mode of ["markdown", "html"] as const) {
        let expression = "";
        const ctx = context([]);
        (ctx.fns.browser.evaluate as any) = async ({ expression: value }: any) => {
            expression = value;
            return { title: "Readable", url: "https://read.test", readyState: "complete", content: `${mode}-body` };
        };
        const result = await snapshot(ctx, null, { mode });
        expect(result.content).toBe(`${mode}-body`);
        expect(result.mode).toBe(mode);
        expect(expression).toContain(`const outputMode = \"${mode}\"`);
    }
});
test("unknown comparison revision fails explicitly", async () => {
    await expect(snapshot(context(nodes), null, { sinceRevision: "r999" })).rejects.toThrow(/unknown revision/);
});
