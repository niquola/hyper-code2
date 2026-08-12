import { expect, test } from "bun:test";
import render from "./agentsRail";

const attr = (opts: any) => Object.entries(opts).map(([k, v]) => `data-${k}="${v}"`).join(" ");

test("renders delegated agents nested below their parent", async () => {
    const agents = [
        { id: "child", model: "claude-code:claude-haiku-4-5", title: "research", workspaceDir: "/repo", runState: "idle", unread: 0, archivedAt: null, parentId: "root", delegated: true },
        { id: "root", model: "codex:gpt-5.6-sol", title: "main", workspaceDir: "/repo", runState: "idle", unread: 0, archivedAt: null, parentId: null, delegated: false },
        { id: "grand", model: "kimi:kimi-k3", title: "source check", workspaceDir: "/repo", runState: "running", unread: 1, archivedAt: null, parentId: "child", delegated: true },
    ];
    const ctx = { fns: {
        session: { list: async () => agents },
        procs: { ui: { escape: ({ text }: any) => String(text), attr } },
        ui: { modelLogo: ({ model, active }: any) => `<span title="${model}" class="${active ? 'animate-spin' : ''}">logo</span>` },
    } } as unknown as Context;

    const html = await render(ctx, null, { currentId: "root" });
    expect(html.indexOf("(root)")).toBeLessThan(html.indexOf("(child)"));
    expect(html.indexOf("(child)")).toBeLessThan(html.indexOf("(grand)"));
    expect(html).toContain("2 subagents");
    expect(html).toContain("1 active");
    expect(html).toContain("<details");
    expect(html).not.toMatch(/<details[^>]*open/);
    expect(html.match(/title="subagent of/g)?.length).toBe(2);
    expect(html).toContain('title="subagent of');
    expect(html).not.toContain("border-indigo-100");
    expect(html).toContain('title="codex:gpt-5.6-sol"');
    expect(html.indexOf('title="codex:gpt-5.6-sol"')).toBeLessThan(html.indexOf('(root)'));
    expect(html).toContain('title="kimi:kimi-k3" class="animate-spin"');
    expect(html).not.toContain('rounded-full bg-emerald-500 animate-pulse');
    expect(html).not.toContain('rounded-full bg-gray-300');
});


test("opens the folded subagent group when current agent is inside it", async () => {
    const agents = [
        { id: "root", model: "m", title: "main", workspaceDir: "/repo", runState: "idle", unread: 0, archivedAt: null, parentId: null },
        { id: "child", model: "m", title: "child", workspaceDir: "/repo", runState: "idle", unread: 0, archivedAt: null, parentId: "root" },
    ];
    const ctx = { fns: { session: { list: async () => agents }, procs: { ui: { escape: ({ text }: any) => String(text), attr } }, ui: { modelLogo: () => "logo" } } } as any;
    const html = await render(ctx, null, { currentId: "child" });
    expect(html).toMatch(/<details[^>]*open/);
    expect(html).toContain("1 subagent");
});
