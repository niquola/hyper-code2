import { expect, test } from "bun:test";
import render from "./agentMetaPanel";
import renderSection from "./agentMetaSection";

const escapeHtml = ({ text }: any) => String(text)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const toggle = (o: any) => `<label><input name="${o.name}" ${o.enabled ? 'checked' : ''}>${o.label ?? ''}</label>`;
const planTaskRow = ({ task }: any) => `<div data-plan-task data-task-id="${escapeHtml({ text: task.id })}" data-task-status="${task.status}"><input name="task_id" value="${escapeHtml({ text: task.id })}"><input name="task_title" value="${escapeHtml({ text: task.title })}"><textarea name="task_instructions">${escapeHtml({ text: task.instructions ?? '' })}</textarea><span>${Math.floor(Number(task.elapsedMs ?? 0) / 1000)}s</span>${task.status === 'pending' ? '<button data-plan-remove></button><button data-plan-move="up"></button>' : ''}</div>`;
const button = (o: any) => `<button type="${o.type ?? (o.name ? 'submit' : 'button')}" class="ui-button ui-button--${o.size ?? 'sm'} ui-button--${o.tone ?? 'default'}"${o.action ? ` data-action="${o.action}"` : ''}${o.get ? ` hx-get="${o.get}"` : ''}${o.post ? ` hx-post="${o.post}"` : ''}${o.target ? ` hx-target="${o.target}"` : ''}${o.swap ? ` hx-swap="${o.swap}"` : ''}>${o.html ?? escapeHtml({ text: o.label ?? '' })}</button>`;
const mkCtx = (extra: any = {}): any => {
    const ctx: any = {
        fns: {
            procs: { ui: { escape: escapeHtml, button } },
            ui: {
                toggle,
                planTaskRow,
                statusBadge: (o: any) => `<span data-tone="${o.tone ?? 'neutral'}">${escapeHtml({ text: o.label })}</span>`,
                progressBar: (o: any) => `<progress value="${o.value}" max="${o.max}"></progress>`,
                inspectorSection: (o: any) => `<details ${o.open ? 'open' : ''}><summary>${escapeHtml({ text: o.title })}${o.badge ?? ''}</summary><div class="border-t border-base-300 px-3 py-3">${o.html}</div></details>`,
                // The runtime calls this in the injected style ctx.fns.x(opts),
                // while the imported module takes (ctx, session, opts) — bridge it.
                agentMetaSection: (o: any) => renderSection(ctx, null, o),
                ...extra,
            },
        },
    };
    return ctx;
};

test("agent meta panel is a static shell with per-section slots", () => {
    const html = render(mkCtx(), null, { agent: { id: "eh", goal: null } as any });
    expect(html).toContain('id="agent-meta-eh"');
    for (const section of ["goal", "automation", "wake", "team", "plan"]) {
        expect(html).toContain(`id="agent-meta-${section}-eh"`);
        expect(html).toContain(`data-meta-section="${section}"`);
    }
    // No live region: sections are redrawn through the RPC push, not polling.
    expect(html).not.toContain("data-live-topic");
    expect(html).not.toContain("hx-get");
});

test("collapses an inactive goal and opens an enabled goal", () => {
    const ctx = mkCtx();
    const inactive = render(ctx, null, { agent: { id: "eh", goal: { statement: "done", enabled: false, status: "achieved", checks: [] } } as any });
    expect(inactive).toContain('<summary>Goal<span data-tone="success">achieved</span></summary>');
    expect(inactive).not.toContain('<details open><summary>Goal');
    const active = render(ctx, null, { agent: { id: "eh", goal: { statement: "work", enabled: true, status: "active", checks: [] } } as any });
    expect(active).toContain('<details open><summary>Goal');
});

test("renders plan tasks with ids and editor fields", () => {
    const ctx = mkCtx();
    const agent: any = {
        id: "eh", goal: null,
        scratchpad: { plan: { title: "Ship", tasks: [
            { id: "active", title: "Doing", status: "active", instructions: "now" },
            { id: "later", title: "Next", status: "pending", instructions: "later" },
        ] } },
    };
    const html = render(ctx, null, { agent });
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
    const html = render(mkCtx(), null, {
        agent: { id: "eh", goal: null } as any,
        team: [{ id: "kid", title: "Visual QA", runState: "running", status: "blocked", plan: { title: "QA", tasks: [{ id: "see", title: "Inspect", status: "active" }] }, summary: null, updatedAt: Date.now() }],
    });
    expect(html).toContain("Team");
    expect(html).toContain('data-tone="error"');
    expect(html).toContain('class="ui-button ui-button--xs ui-button--ghost');
    expect(html).toContain('<progress value="0" max="1">');
});

test("automation controls live in a collapsed compact accordion", () => {
    const html = render(mkCtx(), null, { agent: { id: "eh", goal: null } as any });
    expect(html).toContain('>Automation</summary>');
    const slot = html.slice(html.indexOf('id="agent-meta-automation-eh"'), html.indexOf('id="agent-meta-wake-eh"'));
    expect(slot).not.toContain("<details open");
});

test("a section renders standalone and an unknown section throws", () => {
    const ctx = mkCtx();
    const html = renderSection(ctx, null, { agent: { id: "eh", goal: null } as any, section: "automation" });
    expect(html).toContain("Automation");
    expect(html).not.toContain("agent-meta-goal");
    expect(() => renderSection(ctx, null, { agent: { id: "eh" } as any, section: "nope" as any })).toThrow(/unknown section/);
});


test("meta panel exposes a persistent collapse control", () => {
    const html = render(mkCtx(), null, { agent: { id: "eh", goal: null } as any });
    expect(html).toContain("data-agent-meta-panel");
    expect(html).toContain('data-action="toggle-agent-meta"');
    expect(html).toContain("data-agent-meta-content");
});
