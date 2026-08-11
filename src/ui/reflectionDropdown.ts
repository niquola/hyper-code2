export default function (ctx: Context, _session: Session | null, opts: { agent: types.agent.Agent }): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const agent = opts.agent;
    const reflection = agent.reflection?.state ?? null;
    const running: Set<string> | undefined = (ctx.state as any).reflectionRuns;
    const active = !!running?.has(agent.id);
    const idAttr = `id="reflection-${esc(agent.id)}"`;
    const poll = `${idAttr} hx-get="/agent/${encodeURIComponent(agent.id)}/reflection" hx-trigger="every 1s" hx-swap="outerHTML"`;

    if (active) return `<span ${poll} class="rounded border border-violet-200 bg-violet-50 px-2 py-1 text-violet-700" title="Reflection is running"><i class="ph ph-brain animate-spin"></i> reflecting…</span>`;
    if (!reflection) return `<span ${poll} class="rounded border border-gray-200 px-2 py-1 text-gray-400" title="Reflection appears after 3 user messages"><i class="ph ph-brain"></i> reflection pending</span>`;

    return `<details ${idAttr} class="relative">
      <summary class="cursor-pointer list-none rounded border border-violet-200 bg-violet-50 px-2 py-1 text-violet-700 hover:bg-violet-100" title="conversation reflection"><i class="ph ph-brain"></i> reflection</summary>
      <div class="absolute right-0 top-7 z-30 w-96 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white p-3 text-left shadow-xl">
        <div class="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">What we are doing</div>
        <div class="font-medium text-gray-800">${esc(reflection.activity?.goal ?? 'Unknown')}</div>
        <div class="mt-1 text-gray-600">${esc(reflection.activity?.currentStep ?? '')}</div>
        ${reflection.activity?.nextStep ? `<div class="mt-2 text-gray-500"><span class="font-medium">Next:</span> ${esc(reflection.activity.nextStep)}</div>` : ''}
        <div class="mt-3 border-t border-gray-100 pt-2 font-medium text-gray-700">Tasks</div>
        ${(reflection.tasks ?? []).length ? `<ul class="mt-1 space-y-1.5">${reflection.tasks.map((task: any) => { const icon = task.status === 'done' ? '✓' : task.status === 'doing' ? '●' : task.status === 'blocked' ? '!' : '○'; const color = task.status === 'done' ? 'text-green-600' : task.status === 'doing' ? 'text-blue-600' : task.status === 'blocked' ? 'text-red-600' : 'text-gray-400'; return `<li class="flex gap-2"><span class="${color}">${icon}</span><span class="min-w-0"><span class="text-gray-700">${esc(task.title)}</span>${task.nextStep ? `<div class="text-gray-400">${esc(task.nextStep)}</div>` : ''}</span></li>`; }).join('')}</ul>` : '<div class="mt-1 text-gray-400">No tasks extracted</div>'}
        ${reflection.reflectionNudge?.text ? `<div class="mt-3 rounded-md border border-violet-100 bg-violet-50 p-2"><div class="text-[10px] font-semibold uppercase tracking-wide text-violet-500">Reflection nudge · ${Number(reflection.reflectionNudge.expiresAfterTurns ?? 3)} turns</div><div class="mt-1 text-violet-800">${esc(reflection.reflectionNudge.text)}</div>${reflection.reflectionNudge.reason ? `<div class="mt-1 text-violet-500">${esc(reflection.reflectionNudge.reason)}</div>` : ''}</div>` : ''}

        <div class="mt-3 border-t border-gray-100 pt-2"><span class="font-medium text-gray-700">User:</span> ${esc(reflection.userSatisfaction?.level ?? 'unknown')} · ${esc(reflection.userSatisfaction?.trend ?? 'unknown')}</div>
        ${(reflection.userSatisfaction?.reasons ?? []).length ? `<ul class="mt-1 list-disc space-y-1 pl-4 text-gray-500">${reflection.userSatisfaction.reasons.map((x: any) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        <div class="mt-3 border-t border-gray-100 pt-2 font-medium text-gray-700">Mistakes</div>
        ${(reflection.mistakes ?? []).length ? `<ul class="mt-1 space-y-2">${reflection.mistakes.map((m: any) => `<li><span class="text-gray-700">${esc(m.description)}</span><div class="text-gray-400">${esc(m.status)} · ${esc(m.lesson)}</div></li>`).join('')}</ul>` : '<div class="mt-1 text-gray-400">No significant mistakes noted</div>'}
      </div>
    </details>`;
}
