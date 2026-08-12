export default function (ctx: Context, _session: Session | null, opts: { agent: types.agent.Agent }): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const agent = opts.agent;
    const goal = agent.goal ?? null;
    const last = goal?.checks?.at(-1) ?? null;
    const statusColor = goal?.status === 'achieved' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : goal?.status === 'blocked' ? 'text-red-700 bg-red-50 border-red-200' : 'text-indigo-700 bg-indigo-50 border-indigo-200';
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
      </div>
    `});
}
