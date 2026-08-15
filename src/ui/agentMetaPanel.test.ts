import { expect, test } from "bun:test";
import render from "./agentMetaPanel";

const escapeHtml = ({ text }: any) => String(text)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const toggle = (o: any) => `<label><input name="${o.name}" ${o.enabled ? 'checked' : ''}>${o.label ?? ''}</label>`;

test("agent meta panel is a topic-addressed live region", () => {
    const ctx: any = { fns: {
        procs: { ui: { escape: escapeHtml } },
        ui: { toggle, live: (o: any) => `<${o.tag} id="${o.id}" hx-get="${o.url}" data-live-topic="${o.topic}" ${o.attrs}>${o.html}</${o.tag}>` },
    } };
    const html = render(ctx, null, { agent: { id: "eh", goal: null } as any });
    expect(html).toContain('id="agent-meta-eh"');
    expect(html).toContain('hx-get="/ui/agent/eh/meta"');
    expect(html).toContain('data-live-topic="agent-meta:eh"');
});
test("collapses an inactive goal and opens an enabled goal", () => {
    const ctx: any = { fns: {
        procs: { ui: { escape: escapeHtml } },
        ui: { toggle, live: (o: any) => o.html, planTaskRow: ({ task }: any) => `<div data-plan-task data-task-id="${escapeHtml({text:task.id})}" data-task-status="${task.status}"><input name="task_id" value="${escapeHtml({text:task.id})}"><input name="task_title" value="${escapeHtml({text:task.title})}"><textarea name="task_instructions">${escapeHtml({text:task.instructions ?? ''})}</textarea><span>${Math.floor(Number(task.elapsedMs ?? 0)/1000)}s</span>${task.status === 'pending' ? '<button data-plan-remove></button><button data-plan-move="up"></button>' : ''}</div>` },
    } };
    const inactive = render(ctx, null, { agent: { id: "eh", goal: { statement: "done", enabled: false, status: "achieved", checks: [] } } as any });
    expect(inactive).toContain('<summary>Goal</summary>');
    expect(inactive).not.toContain('<details open><summary>Goal</summary>');
    const active = render(ctx, null, { agent: { id: "eh", goal: { statement: "work", enabled: true, status: "active", checks: [] } } as any });
    expect(active).toContain('<details open><summary>Goal</summary>');
});



test("renders the plan below goal with instructions and time", () => {
    const ctx: any = { fns: {
        procs: { ui: { escape: escapeHtml } },
        ui: { toggle, live: (o: any) => o.html, planTaskRow: ({ task }: any) => `<div data-plan-task data-task-id="${escapeHtml({text:task.id})}" data-task-status="${task.status}"><input name="task_id" value="${escapeHtml({text:task.id})}"><input name="task_title" value="${escapeHtml({text:task.title})}"><textarea name="task_instructions">${escapeHtml({text:task.instructions ?? ''})}</textarea><span>${Math.floor(Number(task.elapsedMs ?? 0)/1000)}s</span>${task.status === 'pending' ? '<button data-plan-remove></button><button data-plan-move="up"></button>' : ''}</div>` },
    } };
    const html = render(ctx, null, { agent: { id: "eh", goal: null, scratchpad: { plan: {
        title: "Ship it", tasks: [{ id: "api", title: "Build API", instructions: "Detailed requirements", status: "active", elapsedMs: 5000, activeSince: null }],
    } } } } as any);
    expect(html.indexOf("Goal")).toBeLessThan(html.indexOf("Ship it"));
    expect(html).toContain("Build API");
    expect(html).toContain("Detailed requirements");
    expect(html).toContain("5s");
});


test("escapes plan content and renders archive/delete controls inside the scroll panel", () => {
    const ctx: any = { fns: {
        procs: { ui: { escape: escapeHtml } },
        ui: { toggle, live: (o: any) => o.html, planTaskRow: ({ task }: any) => `<div data-plan-task data-task-id="${escapeHtml({text:task.id})}" data-task-status="${task.status}"><input name="task_id" value="${escapeHtml({text:task.id})}"><input name="task_title" value="${escapeHtml({text:task.title})}"><textarea name="task_instructions">${escapeHtml({text:task.instructions ?? ''})}</textarea><span>${Math.floor(Number(task.elapsedMs ?? 0)/1000)}s</span>${task.status === 'pending' ? '<button data-plan-remove></button><button data-plan-move="up"></button>' : ''}</div>` },
    } };
    const html = render(ctx, null, { agent: { id: "a/b", goal: null, scratchpad: { plan: {
        title: "<Plan>", tasks: [{ id: "x", title: "<Task>", instructions: "<script>bad()</script>", status: "active", elapsedMs: 0 }],
    } } } } as any);
    expect(html).toContain("&lt;Plan&gt;");
    expect(html).toContain("&lt;Task&gt;");
    expect(html).toContain("&lt;script&gt;bad()&lt;/script&gt;");
    expect(html).not.toContain("<script>bad()</script>");
    expect(html).toContain('hx-post="/agent/a%2Fb/plan"');
    expect(html).toContain('hx-confirm="Archive this plan?"');
    expect(html).toContain('hx-confirm="Delete this plan permanently?"');
    const scrollStart = html.indexOf('overflow-y-auto');
    expect(html.indexOf("Goal", scrollStart)).toBeLessThan(html.indexOf("&lt;Plan&gt;", scrollStart));
    expect(html.indexOf("&lt;Plan&gt;", scrollStart)).toBeLessThan(html.lastIndexOf("</div>"));
});


test("renders a safe editor with immutable active and removable pending tasks", () => {
    const ctx: any = { fns: {
        procs: { ui: { escape: escapeHtml } },
        ui: { toggle, live: (o: any) => o.html, planTaskRow: ({ task }: any) => `<div data-plan-task data-task-id="${escapeHtml({text:task.id})}" data-task-status="${task.status}"><input name="task_id" value="${escapeHtml({text:task.id})}"><input name="task_title" value="${escapeHtml({text:task.title})}"><textarea name="task_instructions">${escapeHtml({text:task.instructions ?? ''})}</textarea><span>${Math.floor(Number(task.elapsedMs ?? 0)/1000)}s</span>${task.status === 'pending' ? '<button data-plan-remove></button><button data-plan-move="up"></button>' : ''}</div>` },
    } };
    const html = render(ctx, null, { agent: { id: "eh", goal: null, scratchpad: { plan: {
        title: "Edit me", tasks: [
            { id: "active", title: "Active", instructions: "Now", status: "active", elapsedMs: 0 },
            { id: "later", title: "Later", instructions: "Then", status: "pending", elapsedMs: 0 },
        ],
    } } } } as any);
    expect(html).toContain("data-plan-editor");
    expect(html).toContain('name="action" value="update"');
    expect(html).not.toContain("Edit plan");
    expect(html).toContain('name="title"');
    expect(html).toContain('name="task_id"');
    expect(html).toContain('name="task_title"');
    expect(html).toContain('name="task_instructions"');
    expect(html).toContain('hx-get="/ui/agent/eh/plan/task"');
    const active = html.slice(html.indexOf('data-task-id="active"'), html.indexOf('data-task-id="later"'));
    const pending = html.slice(html.indexOf('data-task-id="later"'));
    expect(active).not.toContain("data-plan-remove");
    expect(pending).toContain("data-plan-remove");
    expect(pending).toContain('data-plan-move="up"');
});



test("renders team members as semantic nested accordions", () => {
    const ctx: any = { fns: {
        procs: { ui: { escape: escapeHtml } },
        ui: {
            toggle,
            live: (o: any) => o.html,
            statusBadge: (o: any) => `<span data-tone="${o.tone}">${escapeHtml({ text: o.label })}</span>`,
            progressBar: (o: any) => `<progress value="${o.value}" max="${o.max}"></progress>`,
            inspectorSection: (o: any) => `<section>${o.title}${o.badge}${o.html}</section>`,
        },
    } };
    const html = render(ctx, null, {
        agent: { id: "eh", goal: null } as any,
        team: [{ id: "kid", title: "Visual QA", runState: "running", status: "blocked", plan: { title: "QA", tasks: [{ id: "see", title: "Inspect", status: "active" }] }, summary: null, updatedAt: Date.now() }],
    });
    expect(html).toContain("Team");
    expect(html).toContain('data-tone="error"');
    expect(html).toContain("group-open:rotate-180");
    expect(html).toContain('class="btn btn-ghost btn-xs');
    expect(html).toContain('<progress value="0" max="1">');
});

test("automation controls live in a collapsed compact accordion", () => {
    const ctx: any = { fns: {
        procs: { ui: { escape: escapeHtml } },
        ui: { toggle, live: (o: any) => o.html, statusBadge: (o: any) => `<span>${o.label}</span>`, inspectorSection: (o: any) => `<details ${o.open ? 'open' : ''}><summary><span>${o.title}</span></summary><div class="border-t border-base-300 px-3 py-3">${o.html}</div></details>` },
    } };
    const html = render(ctx, null, { agent: { id: "eh", goal: null } as any });
    expect(html).toContain('>Automation</span>');
    expect(html).toContain('border-t border-base-300 px-3 py-3');
    expect(html).not.toMatch(/<details open[^>]*>[\s\S]*?<summary[^>]*>[\s\S]*?>Automation<\/span>/);
});
