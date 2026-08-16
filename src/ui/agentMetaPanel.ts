/** Performs the ui.agentMetaPanel runtime operation. */
/**
 * Render the metadata panel for an agent.
 * @param opts.agent Agent associated with the operation.
 */
export default function (ctx: Context, _session: Session | null, opts: {
        /** Agent associated with the operation. */ agent: types.agent.Agent;
        /** Direct delegated children with their existing plans. */ team?: Array<{ id: string; title: string; runState: string; status: string; plan: any; summary: string | null; updatedAt: number; archivedAt?: number | null }>;
        /** Archived delegated children displayed by the Team filter. */ archivedTeam?: Array<{ id: string; title: string; runState: string; status: string; plan: any; summary: string | null; updatedAt: number; archivedAt?: number | null }> }): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const agent = opts.agent;
    const goal = agent.goal ?? null;
    const last = goal?.checks?.at(-1) ?? null;
    const plan = agent.scratchpad?.plan ?? null;

    const tasks = Array.isArray(plan?.tasks) ? plan.tasks : [];
    const doneCount = tasks.filter((task: any) => task.status === 'done').length;
    const team = Array.isArray(opts.team) ? opts.team : [];
    const archivedTeam = Array.isArray(opts.archivedTeam) ? opts.archivedTeam : [];
    const allTeam = [...team, ...archivedTeam];
    const statusBadge = ctx.fns.ui.statusBadge ?? ((badgeOpts: any) => `<span class="badge badge-sm">${esc(badgeOpts.label)}</span>`);
    const progressBar = ctx.fns.ui.progressBar ?? ((progressOpts: any) => `<progress value="${Number(progressOpts.value)}" max="${Math.max(1, Number(progressOpts.max))}"></progress>`);
    const inspectorSection = ctx.fns.ui.inspectorSection ?? ((sectionOpts: any) => `<details ${sectionOpts.open ? 'open' : ''}><summary>${esc(sectionOpts.title)}</summary><div>${sectionOpts.html}</div></details>`);
    const teamHtml = allTeam.length ? inspectorSection({
      title: 'Team', icon: 'users-three', badge: statusBadge({ label: String(team.length), tone: team.some((member: any) => member.status === 'failed' || member.status === 'blocked') ? 'error' : team.some((member: any) => member.status === 'working') ? 'info' : 'neutral' }), collapsible: true,
      open: team.some((member: any) => member.status === 'working' || member.status === 'blocked' || member.status === 'failed'), html: `
      ${archivedTeam.length ? `<label class="mt-2 flex items-center gap-1.5 text-[10px] text-base-content/55"><input type="checkbox" onchange="this.closest('details').querySelector('[data-team-archive-list]').classList.toggle('hidden', !this.checked)"> Show archived (${archivedTeam.length})</label>` : ''}
      <div class="space-y-2">${team.map((member: any) => {
        const memberTasks = Array.isArray(member.plan?.tasks) ? member.plan.tasks : [];
        const memberDone = memberTasks.filter((task: any) => task.status === 'done').length;
        const statusTone = member.status === 'ready' ? 'success' : member.status === 'failed' || member.status === 'blocked' ? 'error' : member.status === 'working' ? 'info' : 'neutral';
        const memberBadge = statusBadge({ label: String(member.status), tone: statusTone, dot: member.status === 'working' });
        return `<details class="group overflow-hidden rounded-lg border border-ui-border bg-base-200" ${member.status === 'working' ? 'open' : ''}>
          <summary class="flex min-h-10 cursor-pointer list-none items-center gap-2 px-2.5 py-2 hover:bg-base-200/60"><i class="ph ph-robot text-base-content/75"></i><span class="min-w-0 flex-1 truncate text-xs font-medium text-base-content">${esc(member.title || `Agent ${member.id}`)}</span>${memberBadge}<span class="font-mono text-[10px] tabular-nums text-base-content/45">${memberDone}/${memberTasks.length}</span><i class="ph ph-caret-down text-[10px] text-base-content/35 transition-transform group-open:rotate-180"></i></summary>
          <div class="space-y-2 border-t border-ui-border px-2.5 py-2">
            ${memberTasks.length ? progressBar({ value: memberDone, max: memberTasks.length, label: member.plan?.title || 'Task progress', showValue: false }) : ''}
            <div class="space-y-1.5">${memberTasks.map((task: any) => `<div class="text-[11px] leading-4 ${task.status === 'done' ? 'text-base-content/40' : task.status === 'active' ? 'text-base-content/80' : 'text-base-content/60'}"><div class="flex items-start gap-1.5"><i class="ph ${task.status === 'done' ? 'ph-check-circle text-success' : task.status === 'active' ? 'ph-circle-notch animate-spin' : 'ph-circle'} mt-0.5"></i><span>${esc(task.title)}</span></div>${task.resultSummary ? `<div class="ml-4 mt-0.5 text-base-content/50">${esc(task.resultSummary)}</div>` : ''}</div>`).join('')}</div>
            ${member.summary ? `<div class="mt-2 border-t border-ui-border pt-2 text-[10px] leading-4 text-base-content/55">${esc(member.summary)}</div>` : ''}
            <div class="flex items-center gap-1 border-t border-ui-border pt-2"><a href="/agent/${encodeURIComponent(member.id)}" class="btn btn-ghost btn-xs"><i class="ph ph-arrow-square-out"></i> Open</a>${member.status === 'working' || member.runState === 'running' ? `<form hx-post="/agent/${encodeURIComponent(agent.id)}/team/${encodeURIComponent(member.id)}/stop" hx-swap="none" hx-confirm="Stop this subagent?"><button class="btn btn-ghost btn-xs text-warning"><i class="ph ph-stop-circle"></i> Stop</button></form>` : ''}${member.status === 'blocked' || member.status === 'failed' ? `<form hx-post="/agent/${encodeURIComponent(agent.id)}/team/${encodeURIComponent(member.id)}/retry" hx-swap="none"><button class="btn btn-ghost btn-xs text-primary"><i class="ph ph-arrow-clockwise"></i> Retry</button></form>` : ''}${member.status !== 'working' && member.runState !== 'running' ? `<form hx-post="/agent/${encodeURIComponent(agent.id)}/team/${encodeURIComponent(member.id)}/archive" hx-swap="none"><button class="btn btn-ghost btn-xs text-base-content/55 hover:text-error"><i class="ph ph-archive"></i> Archive</button></form>` : ''}</div>
          </div>
        </details>`;
      }).join('')}</div>
      ${archivedTeam.length ? `<div data-team-archive-list class="mt-2 hidden space-y-2">${archivedTeam.map((member: any) => { const archivedTasks = Array.isArray(member.plan?.tasks) ? member.plan.tasks : []; return `<details class="rounded-lg border border-ui-border bg-base-200 opacity-80"><summary class="flex cursor-pointer list-none items-center gap-2 px-2.5 py-2"><i class="ph ph-archive text-base-content/45"></i><span class="min-w-0 flex-1 truncate text-xs text-base-content/65">${esc(member.title || `Agent ${member.id}`)}</span><span class="text-[10px] text-base-content/45">${archivedTasks.filter((task: any) => task.status === 'done').length}/${archivedTasks.length}</span></summary><div class="border-t border-ui-border px-2.5 py-2"><div class="space-y-1">${archivedTasks.map((task: any) => `<div class="text-[10px] leading-4 text-base-content/55"><div class="flex items-start gap-1.5"><i class="ph ${task.status === 'done' ? 'ph-check-circle' : 'ph-circle'} mt-0.5"></i><span>${esc(task.title)}</span></div>${task.resultSummary ? `<div class="ml-4 mt-0.5 text-base-content/45">${esc(task.resultSummary)}</div>` : ''}</div>`).join('')}</div>${member.summary ? `<div class="mt-2 border-t border-ui-border pt-2 text-[10px] leading-4 text-base-content/55">${esc(member.summary)}</div>` : ''}<div class="mt-2 flex items-center gap-2"><form hx-post="/agent/${encodeURIComponent(agent.id)}/team/${encodeURIComponent(member.id)}/unarchive" hx-swap="none" hx-on::after-request="if(event.detail.successful) location.href='/agent/${encodeURIComponent(member.id)}'"><button class="text-[10px] text-indigo-600 hover:text-indigo-800"><i class="ph ph-arrow-counter-clockwise"></i> Restore &amp; open</button></form></div></div></details>`; }).join('')}</div>` : ''}
      ` }) : '';

    const goalBody = `<form hx-post="/agent/${encodeURIComponent(agent.id)}/goal" hx-swap="none" hx-trigger="change delay:300ms" class="space-y-3">
      <label class="block text-[11px] text-base-content/55">Goal<textarea name="statement" rows="5" maxlength="2000" placeholder="What must the agent achieve?" class="textarea textarea-bordered mt-1 w-full resize-y text-sm leading-5">${esc(goal?.statement ?? '')}</textarea></label>
      <div class="flex items-end gap-3"><label class="min-w-0 flex-1 text-[11px] text-base-content/55">Continuation iterations<input name="iterations" type="number" min="1" max="10" value="${Math.max(1, Math.min(10, Number(goal?.maxIterations ?? 3)))}" class="input input-bordered input-sm mt-1 w-full"></label>${ctx.fns.ui.toggle({ name: 'enabled', enabled: !!goal?.enabled, label: goal?.enabled ? 'On' : 'Off', compact: true, title: goal?.enabled ? 'Disable goal loop' : 'Enable goal loop' })}</div>
    </form>${last ? `<div class="mt-3 border-t border-ui-border pt-3 text-xs"><div class="font-medium text-base-content/70">Last check: ${esc(last.status)}</div><div class="mt-1 leading-5 text-base-content/55">${esc(last.reason)}</div>${last.nextStep ? `<div class="mt-1 text-base-content/40">Next: ${esc(last.nextStep)}</div>` : ''}</div>` : ''}<p class="mt-3 text-[10px] leading-4 text-base-content/40">The goal is checked whenever the agent tries to finish. Only “continue” wakes it again; blocked or needs-user stops the run.</p>`;
    const goalSection = inspectorSection({ title: 'Goal', icon: 'target', badge: goal ? statusBadge({ label: String(goal.status ?? 'active'), tone: goal.status === 'achieved' ? 'success' : goal.status === 'blocked' ? 'error' : 'info' }) : undefined, html: goalBody, collapsible: true, open: !!goal?.enabled });
    const automationBody = `<form hx-post="/agent/${encodeURIComponent(agent.id)}/automation" hx-swap="none" hx-trigger="change delay:200ms" class="space-y-1">${ctx.fns.ui.toggle({ label: 'Reflection', name: 'reflectionEnabled', enabled: agent.reflectionEnabled !== false, hint: 'Periodic conversation analysis and nudges' })}${ctx.fns.ui.toggle({ label: 'Sleep', name: 'sleepEnabled', enabled: agent.sleepEnabled !== false, hint: 'Idle context consolidation after 15 minutes' })}${ctx.fns.ui.toggle({ label: 'Function RAG', name: 'functionRagEnabled', enabled: agent.functionRagEnabled === true, hint: 'Retrieve relevant runtime functions for each user prompt' })}</form>`;
    const automationSection = inspectorSection({ title: 'Automation', icon: 'sliders-horizontal', html: automationBody, collapsible: true });
    const wakeBody = agent.wakeAt ? `<div class="truncate text-[11px] leading-5 text-base-content/55" title="${esc(agent.wakeReason ?? '')}">${esc(agent.wakeReason ?? '')}</div><form hx-post="/agent/${encodeURIComponent(agent.id)}/wake" hx-swap="none" class="mt-2"><input type="hidden" name="action" value="cancel"><button class="btn btn-ghost btn-xs text-error">Cancel</button></form>` : `<form hx-post="/agent/${encodeURIComponent(agent.id)}/wake" hx-swap="none" class="space-y-2"><input type="hidden" name="action" value="set"><input name="reason" value="Continue scheduled work" maxlength="1000" aria-label="Wake reason" class="input input-bordered input-sm w-full text-xs"><div class="flex items-center gap-1"><input name="minutes" type="number" min="1" max="10080" value="5" aria-label="Wake in minutes" class="input input-bordered input-sm w-16 text-xs"><span class="text-[10px] text-base-content/40">min</span><button name="preset" value="5" class="btn btn-ghost btn-xs">5m</button><button name="preset" value="60" class="btn btn-ghost btn-xs">1h</button><button class="btn btn-primary btn-xs ml-auto">Set</button></div></form>`;
    const wakeSection = inspectorSection({ title: 'Wake-up', icon: 'alarm', badge: agent.wakeAt ? ctx.fns.ui.wakeTimer({ agent }) : statusBadge({ label: 'off' }), html: wakeBody, collapsible: true });
    const planBody = tasks.length ? `<form data-plan-editor hx-post="/agent/${encodeURIComponent(agent.id)}/plan" hx-swap="none" class="space-y-3"><input type="hidden" name="action" value="update"><div class="flex items-center gap-2"><input name="title" maxlength="300" value="${esc(plan.title || '')}" aria-label="Plan title" class="min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-xs font-medium text-base-content outline-none focus:ring-0"><button type="submit" form="plan-archive-${encodeURIComponent(agent.id)}" title="Archive plan" class="btn btn-ghost btn-xs btn-square"><i class="ph ph-archive"></i></button><button type="submit" form="plan-delete-${encodeURIComponent(agent.id)}" title="Delete plan" class="btn btn-ghost btn-xs btn-square hover:text-error"><i class="ph ph-trash"></i></button></div>${plan.pausedAt ? `<div class="rounded-md bg-warning/10 px-2 py-1 text-[11px] text-warning">Paused by user</div>` : ''}<div id="plan-tasks-${esc(agent.id)}" data-plan-tasks class="space-y-2">${tasks.map((task: any) => ctx.fns.ui.planTaskRow({ task })).join('')}</div><div class="flex items-center gap-2"><button type="button" hx-get="/ui/agent/${encodeURIComponent(agent.id)}/plan/task" hx-target="#plan-tasks-${esc(agent.id)}" hx-swap="beforeend" title="Add task" aria-label="Add task" class="btn btn-ghost btn-xs btn-circle"><i class="ph ph-plus"></i></button><div class="h-px flex-1 bg-base-300"></div><button type="submit" class="btn btn-primary btn-xs">Save</button></div></form><form id="plan-archive-${encodeURIComponent(agent.id)}" hx-post="/agent/${encodeURIComponent(agent.id)}/plan" hx-swap="none" hx-confirm="Archive this plan?"><input type="hidden" name="action" value="archive"></form><form id="plan-delete-${encodeURIComponent(agent.id)}" hx-post="/agent/${encodeURIComponent(agent.id)}/plan" hx-swap="none" hx-confirm="Delete this plan permanently?"><input type="hidden" name="action" value="delete"></form>` : '';
    const planSection = tasks.length ? inspectorSection({ title: String(plan.title || 'Plan'), icon: 'list-checks', badge: statusBadge({ label: `${doneCount}/${tasks.length}`, tone: doneCount === tasks.length ? 'success' : 'info' }), html: planBody, collapsible: true, open: tasks.some((task: any) => task.status === 'active') }) : '';
    return ctx.fns.ui.live({
      id: `agent-meta-${agent.id}`,
      url: `/ui/agent/${encodeURIComponent(agent.id)}/meta`,
      topic: `agent-meta:${agent.id}`,
      every: 0,
      tag: 'aside',
      attrs: 'class="flex h-full w-80 shrink-0 flex-col border-l border-ui-border bg-base-200 text-base-content"',
      html: `
      <header class="flex h-8 shrink-0 items-center gap-2 border-b border-ui-border bg-base-200 px-3">
        <i class="ph ph-sidebar-simple text-sm text-base-content/45" aria-hidden="true"></i><span class="min-w-0 flex-1 truncate text-xs font-semibold text-base-content">Agent inspector</span><span class="font-mono text-[10px] text-base-content/40">${esc(agent.id)}</span>
      </header>
      <div class="flex-1 overflow-y-auto bg-base-200">
        ${goalSection}
        ${automationSection}
        ${wakeSection}
        ${teamHtml}
        ${planSection}
      </div>
    `});
}
