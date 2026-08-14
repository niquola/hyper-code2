/** Performs the ui.agentMetaPanel runtime operation. */
/**
 * Render the metadata panel for an agent.
 * @param opts.agent Agent associated with the operation.
 */
export default function (ctx: Context, _session: Session | null, opts: {
        /** Agent associated with the operation. */ agent: types.agent.Agent }): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const agent = opts.agent;
    const goal = agent.goal ?? null;
    const last = goal?.checks?.at(-1) ?? null;
    const statusColor = goal?.status === 'achieved' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : goal?.status === 'blocked' ? 'text-red-700 bg-red-50 border-red-200' : 'text-indigo-700 bg-indigo-50 border-indigo-200';
    const plan = agent.scratchpad?.plan ?? null;

    const tasks = Array.isArray(plan?.tasks) ? plan.tasks : [];
    const doneCount = tasks.filter((task: any) => task.status === 'done').length;
    const fmtTime = (ms: number) => {
        const seconds = Math.max(0, Math.floor(ms / 1000));
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        return minutes < 60 ? `${minutes}m ${seconds % 60}s` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    };
    const taskTime = (task: any) => Math.max(0, Number(task.elapsedMs ?? 0)) + (task.status === 'active' && task.activeSince ? Math.max(0, Date.now() - Number(task.activeSince)) : 0);
    return ctx.fns.ui.live({
      id: `agent-meta-${agent.id}`,
      url: `/ui/agent/${encodeURIComponent(agent.id)}/meta`,
      topic: `agent-meta:${agent.id}`,
      every: 0,
      tag: 'aside',
      attrs: 'class="flex h-full w-80 shrink-0 flex-col border-l border-gray-300 bg-gray-50"',
      html: `
      <div class="flex-1 overflow-y-auto p-4">
        <details ${goal?.enabled ? 'open' : ''} class="group rounded-xl border border-gray-200 bg-white shadow-sm">
          <summary class="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl p-3 hover:bg-gray-50" title="${goal?.enabled ? 'Active goal' : 'Open goal settings'}"><div class="font-medium text-gray-800"><i class="ph ph-target mr-1 text-indigo-500"></i> Goal</div><div class="flex items-center gap-2">${goal ? `<span class="rounded-full border px-2 py-0.5 text-[10px] ${statusColor}">${esc(goal.status ?? 'active')}</span>` : ''}<i class="ph ph-caret-down text-xs text-gray-400 transition-transform group-open:rotate-180" aria-hidden="true"></i></div></summary>
          <div class="border-t border-gray-100 px-3 pb-3">
          <form hx-post="/agent/${encodeURIComponent(agent.id)}/goal" hx-swap="none" hx-trigger="change delay:300ms" class="mt-3 space-y-3">
            <label class="block text-[11px] text-gray-500">Goal
              <textarea name="statement" rows="5" maxlength="2000" placeholder="What must the agent achieve?" class="mt-1 w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm leading-5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-200">${esc(goal?.statement ?? '')}</textarea>
            </label>
            <div class="flex items-end gap-3"><label class="min-w-0 flex-1 text-[11px] text-gray-500">Continuation iterations
              <input name="iterations" type="number" min="1" max="10" value="${Math.max(1, Math.min(10, Number(goal?.maxIterations ?? 3)))}" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800">
            </label>${ctx.fns.ui.toggle({ name: 'enabled', enabled: !!goal?.enabled, label: goal?.enabled ? 'On' : 'Off', compact: true, title: goal?.enabled ? 'Disable goal loop' : 'Enable goal loop' })}</div>
          </form>
          ${last ? `<div class="mt-3 border-t border-gray-100 pt-3 text-xs"><div class="font-medium text-gray-600">Last check: ${esc(last.status)}</div><div class="mt-1 leading-5 text-gray-500">${esc(last.reason)}</div>${last.nextStep ? `<div class="mt-1 text-gray-400">Next: ${esc(last.nextStep)}</div>` : ''}</div>` : ''}
          <p class="mt-3 text-[10px] leading-4 text-gray-400">The goal is checked whenever the agent tries to finish. Only “continue” wakes it again; blocked or needs-user stops the run.</p>
          </div>
        </details>
        <section class="mt-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div class="font-medium text-gray-800"><i class="ph ph-sliders-horizontal mr-1 text-indigo-500"></i> Automation</div>
          <form hx-post="/agent/${encodeURIComponent(agent.id)}/automation" hx-swap="none" hx-trigger="change delay:200ms" class="mt-3 space-y-3">
            ${ctx.fns.ui.toggle({ label: 'Reflection', name: 'reflectionEnabled', enabled: agent.reflectionEnabled !== false, hint: 'Periodic conversation analysis and nudges' })}
            ${ctx.fns.ui.toggle({ label: 'Sleep', name: 'sleepEnabled', enabled: agent.sleepEnabled !== false, hint: 'Idle context consolidation after 15 minutes' })}
            ${ctx.fns.ui.toggle({ label: 'Function RAG', name: 'functionRagEnabled', enabled: agent.functionRagEnabled === true, hint: 'Retrieve relevant runtime functions for each user prompt' })}
          </form>
        </section>

        <details class="group mt-3 rounded-lg border border-gray-200 bg-white shadow-sm">
          <summary class="grid cursor-pointer list-none grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg px-3 py-2 hover:bg-gray-50"><i class="ph ph-alarm text-indigo-500"></i><span class="min-w-0 flex-1 text-sm font-medium text-gray-700">Wake-up</span>${agent.wakeAt ? ctx.fns.ui.wakeTimer({ agent }) : `<span class="text-[10px] text-gray-400">off</span>`}<i class="ph ph-caret-down text-[10px] text-gray-400 transition-transform group-open:rotate-180"></i></summary>
          <div class="border-t border-gray-100 px-3 pb-3 pt-2">
          ${agent.wakeAt ? `<div class="truncate text-[11px] leading-5 text-gray-500" title="${esc(agent.wakeReason ?? '')}">${esc(agent.wakeReason ?? '')}</div><form hx-post="/agent/${encodeURIComponent(agent.id)}/wake" hx-swap="none" class="mt-2"><input type="hidden" name="action" value="cancel"><button class="rounded border border-gray-200 px-2 py-1 text-[10px] text-gray-500 hover:bg-red-50 hover:text-red-600">Cancel</button></form>` : `<form hx-post="/agent/${encodeURIComponent(agent.id)}/wake" hx-swap="none" class="space-y-2"><input type="hidden" name="action" value="set"><input name="reason" value="Continue scheduled work" maxlength="1000" aria-label="Wake reason" class="w-full rounded border border-gray-300 px-2 py-1 text-[11px] text-gray-700"><div class="flex items-center gap-1"><input name="minutes" type="number" min="1" max="10080" value="5" aria-label="Wake in minutes" class="w-16 rounded border border-gray-300 px-2 py-1 text-[11px] text-gray-700"><span class="text-[10px] text-gray-400">min</span><button name="preset" value="5" class="rounded bg-gray-100 px-2 py-1 text-[10px] text-gray-500">5m</button><button name="preset" value="60" class="rounded bg-gray-100 px-2 py-1 text-[10px] text-gray-500">1h</button><button class="ml-auto rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] text-indigo-700">Set</button></div></form>`}
          </div>
        </details>

        ${tasks.length ? `<section class="mt-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <form data-plan-editor hx-post="/agent/${encodeURIComponent(agent.id)}/plan" hx-swap="none" class="space-y-3">
            <input type="hidden" name="action" value="update">
            <div class="flex items-center gap-2"><i class="ph ph-list-checks shrink-0 text-indigo-500"></i><input name="title" maxlength="300" value="${esc(plan.title || '')}" aria-label="Plan title" class="min-w-0 flex-1 truncate border-0 bg-transparent p-0 font-medium text-gray-800 outline-none focus:ring-0"><span class="shrink-0 text-[11px] text-gray-400">${doneCount}/${tasks.length}</span><button type="submit" form="plan-archive-${encodeURIComponent(agent.id)}" title="Archive plan" class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><i class="ph ph-archive"></i></button><button type="submit" form="plan-delete-${encodeURIComponent(agent.id)}" title="Delete plan" class="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"><i class="ph ph-trash"></i></button></div>
            ${plan.pausedAt ? `<div class="rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-700">Paused by user</div>` : ''}
            <div id="plan-tasks-${esc(agent.id)}" data-plan-tasks class="space-y-2">${tasks.map((task: any) => ctx.fns.ui.planTaskRow({ task })).join('')}</div>
            <div class="flex items-center gap-2"><button type="button" hx-get="/ui/agent/${encodeURIComponent(agent.id)}/plan/task" hx-target="#plan-tasks-${esc(agent.id)}" hx-swap="beforeend" title="Add task" aria-label="Add task" class="flex size-7 items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"><i class="ph ph-plus"></i></button><div class="h-px flex-1 bg-gray-100"></div><button type="submit" class="rounded-md bg-indigo-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-indigo-700">Save</button></div>
          </form>
          <form id="plan-archive-${encodeURIComponent(agent.id)}" hx-post="/agent/${encodeURIComponent(agent.id)}/plan" hx-swap="none" hx-confirm="Archive this plan?"><input type="hidden" name="action" value="archive"></form>
          <form id="plan-delete-${encodeURIComponent(agent.id)}" hx-post="/agent/${encodeURIComponent(agent.id)}/plan" hx-swap="none" hx-confirm="Delete this plan permanently?"><input type="hidden" name="action" value="delete"></form>
        </section>` : ''}
      </div>
    `});
}
