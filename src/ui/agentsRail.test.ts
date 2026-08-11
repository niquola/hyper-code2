import { expect, test } from "bun:test";
import render from "./agentsRail";

const attr = (opts: any) => Object.entries(opts).map(([k, v]) => `data-${k}="${v}"`).join(" ");

test("renders delegated agents nested below their parent", async () => {
    const agents = [
        { id: "child", title: "research", workspaceDir: "/repo", runState: "idle", unread: 0, archivedAt: null, parentId: "root", delegated: true },
        { id: "root", title: "main", workspaceDir: "/repo", runState: "idle", unread: 0, archivedAt: null, parentId: null, delegated: false },
        { id: "grand", title: "source check", workspaceDir: "/repo", runState: "running", unread: 1, archivedAt: null, parentId: "child", delegated: true },
    ];
    const ctx = { fns: {
        session: { list: async () => agents },
        procs: { ui: { escape: ({ text }: any) => String(text), attr } },
    } } as unknown as Context;

    const html = await render(ctx, null, { currentId: "root" });
    expect(html.indexOf("(root)")).toBeLessThan(html.indexOf("(child)"));
    expect(html.indexOf("(child)")).toBeLessThan(html.indexOf("(grand)"));
    expect(html.match(/title="subagent of/g)?.length).toBe(2);
    expect(html).toContain('title="subagent of');
    expect(html).not.toContain("border-indigo-100");
});
