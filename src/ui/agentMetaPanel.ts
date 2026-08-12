export default function (ctx: Context, _session: Session | null, opts: { agent: types.agent.Agent }): string {
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
      every: 60,
      tag: 'aside',
      attrs: 'class="flex h-full w-80 shrink-0 flex-col border-l border-gray-300 bg-gray-50"',
      html: `
      <div class="flex-1 overflow-y-auto p-4">
        <section class="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div class="flex items-center justify-between gap-2"><div class="font-medium text-gray-800"><i class="ph ph-target mr-1 text-indigo-500"></i> Goal</div>${goal ? `<span class="rounded-full border px-2 py-0.5 text-[10px] ${statusColor}">${esc(goal.status ?? 'active')}</span>` : ''}</div>
          <form hx-post="/agent/${encodeURIComponent(agent.id)}/goal" hx-swap="none" hx-trigger="change delay:300ms" class="mt-3 space-y-3">
            <label class="block text-[11px] text-gray-500">Goal
              <textarea name="statement" rows="5" maxlength="2000" placeholder="What must the agent achieve?" class="mt-1 w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm leading-5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-200">${esc(goal?.statement ?? '')}</textarea>
            </label>
            <div class="flex items-end gap-3"><label class="min-w-0 flex-1 text-[11px] text-gray-500">Continuation iterations
              <input name="iterations" type="number" min="1" max="10" value="${Math.max(1, Math.min(10, Number(goal?.maxIterations ?? 3)))}" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800">
            </label><label class="mb-1 flex cursor-pointer items-center gap-2" title="${goal?.enabled ? 'Disable goal loop' : 'Enable goal loop'}"><span class="text-[11px] font-medium ${goal?.enabled ? 'text-indigo-700' : 'text-gray-400'}">${goal?.enabled ? 'On' : 'Off'}</span><input name="enabled" type="checkbox" value="1" ${goal?.enabled ? 'checked' : ''} class="peer sr-only"><span class="relative h-6 w-11 rounded-full bg-gray-200 transition peer-checked:bg-indigo-500 peer-focus:ring-2 peer-focus:ring-indigo-200 after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5"></span></label></div>
          </form>
          ${last ? `<div class="mt-3 border-t border-gray-100 pt-3 text-xs"><div class="font-medium text-gray-600">Last check: ${esc(last.status)}</div><div class="mt-1 leading-5 text-gray-500">${esc(last.reason)}</div>${last.nextStep ? `<div class="mt-1 text-gray-400">Next: ${esc(last.nextStep)}</div>` : ''}</div>` : ''}
          <p class="mt-3 text-[10px] leading-4 text-gray-400">The goal is checked whenever the agent tries to finish. Only “continue” wakes it again; blocked or needs-user stops the run.</p>
        </section>
        ${tasks.length ? `<section class="mt-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <form data-plan-editor hx-post="/agent/${encodeURIComponent(agent.id)}/plan" hx-swap="none" class="space-y-3">
            <input type="hidden" name="action" value="update"><input type="hidden" name="plan" value="">
            <div class="flex items-center gap-2"><i class="ph ph-list-checks shrink-0 text-indigo-500"></i><input data-plan-title maxlength="300" value="${esc(plan.title || '')}" aria-label="Plan title" class="min-w-0 flex-1 truncate border-0 bg-transparent p-0 font-medium text-gray-800 outline-none focus:ring-0"><span class="shrink-0 text-[11px] text-gray-400">${doneCount}/${tasks.length}</span><button type="submit" form="plan-archive-${encodeURIComponent(agent.id)}" title="Archive plan" class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><i class="ph ph-archive"></i></button><button type="submit" form="plan-delete-${encodeURIComponent(agent.id)}" title="Delete plan" class="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"><i class="ph ph-trash"></i></button></div>
            ${plan.pausedAt ? `<div class="rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-700">Paused by user</div>` : ''}
            <div data-plan-tasks class="space-y-2">${tasks.map((task: any) => {
                const active = task.status === 'active';
                const icon = task.status === 'done' ? 'ph-check-circle text-emerald-500' : active ? 'ph-circle-notch text-indigo-500' : 'ph-circle text-gray-300';
                return `<div data-plan-task data-task-id="${esc(task.id)}" data-task-status="${esc(task.status)}" class="rounded-lg ${active ? 'bg-indigo-50 p-2' : 'px-2 py-1'}"><div class="flex items-start gap-2 text-xs"><i class="ph ${icon} mt-2"></i><div class="min-w-0 flex-1"><input data-task-title maxlength="300" value="${esc(task.title)}" required aria-label="Task title" class="w-full border-0 bg-transparent p-0 ${task.status === 'done' ? 'text-gray-400 line-through' : active ? 'font-medium text-indigo-900' : 'text-gray-600'} outline-none focus:ring-0"><textarea data-task-instructions maxlength="12000" rows="${active ? 3 : 1}" placeholder="Detailed instructions" aria-label="Task instructions" class="mt-1 w-full resize-y border-0 bg-transparent p-0 text-[11px] leading-4 ${active ? 'text-indigo-700' : 'text-gray-500'} outline-none focus:ring-0">${esc(task.instructions || '')}</textarea><code class="block truncate text-[9px] text-gray-300">${esc(task.id)}</code></div><div class="flex shrink-0 items-center gap-0.5"><span class="text-[10px] text-gray-400">${fmtTime(taskTime(task))}</span>${task.status === 'pending' ? `<button type="button" data-plan-move="up" title="Move up" class="rounded p-1 text-gray-400 hover:bg-gray-100"><i class="ph ph-arrow-up"></i></button><button type="button" data-plan-move="down" title="Move down" class="rounded p-1 text-gray-400 hover:bg-gray-100"><i class="ph ph-arrow-down"></i></button><button type="button" data-plan-remove title="Remove task" class="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"><i class="ph ph-x"></i></button>` : ''}</div></div></div>`;
            }).join('')}</div>
            <div class="flex items-center gap-2"><button type="button" data-plan-add title="Add task" aria-label="Add task" class="flex size-7 items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"><i class="ph ph-plus"></i></button><div class="h-px flex-1 bg-gray-100"></div><button type="submit" class="rounded-md bg-indigo-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-indigo-700">Save</button></div>
          </form>
          <form id="plan-archive-${encodeURIComponent(agent.id)}" hx-post="/agent/${encodeURIComponent(agent.id)}/plan" hx-swap="none" hx-confirm="Archive this plan?"><input type="hidden" name="action" value="archive"></form>
          <form id="plan-delete-${encodeURIComponent(agent.id)}" hx-post="/agent/${encodeURIComponent(agent.id)}/plan" hx-swap="none" hx-confirm="Delete this plan permanently?"><input type="hidden" name="action" value="delete"></form>
        </section>` : ''}
      </div>
    `});
}
