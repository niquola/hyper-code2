// The reflection state is written by a model, and rows written before any
// given validation was added keep whatever shape they had. A view over stored
// data must not throw: `list()` is the only way this file reads a collection,
// so a string where an array was promised renders as one item instead of
// taking the whole agent page down with `.map is not a function`.
const list = (v: any): any[] => Array.isArray(v) ? v : (typeof v === "string" && v.trim() ? [v.trim()] : []);

export default function (ctx: Context, _session: Session | null, opts: { agent: types.agent.Agent }): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const agent = opts.agent;
    const reflection = agent.reflection?.state ?? null;
    const running: Set<string> | undefined = (ctx.state as any).reflectionRuns;
    const active = !!running?.has(agent.id);
    const liveAttrs = `id="reflection-${esc(agent.id)}" hx-get="/agent/${encodeURIComponent(agent.id)}/reflection" hx-trigger="hyper-live from:body, every 60s" hx-target="this" hx-swap="outerHTML" data-live-topic="agent:${esc(agent.id)}"`;

    const buttonClass = 'inline-flex size-7 items-center justify-center rounded-md border transition focus:outline-none focus:ring-2 focus:ring-violet-200';

    if (active) return `<span ${liveAttrs} class="${buttonClass} border-violet-200 bg-violet-50 text-violet-700" title="Reflection is running" aria-label="Reflection is running"><i class="ph ph-brain animate-spin" aria-hidden="true"></i></span>`;
    if (!reflection) return `<span ${liveAttrs} class="${buttonClass} border-gray-200 bg-white text-gray-400" title="Reflection appears after 3 user messages" aria-label="Reflection pending"><i class="ph ph-brain" aria-hidden="true"></i></span>`;

    return `<details ${liveAttrs} class="relative">
      <summary class="${buttonClass} cursor-pointer list-none border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100" title="Conversation reflection" aria-label="Open conversation reflection"><i class="ph ph-brain" aria-hidden="true"></i></summary>
      <div class="absolute right-0 top-7 z-30 w-96 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white p-3 text-left shadow-xl">
        <div class="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">What we are doing</div>
        <div class="font-medium text-gray-800">${esc(reflection.activity?.goal ?? 'Unknown')}</div>
        <div class="mt-1 text-gray-600">${esc(reflection.activity?.currentStep ?? '')}</div>
        ${reflection.activity?.nextStep ? `<div class="mt-2 text-gray-500"><span class="font-medium">Next:</span> ${esc(reflection.activity.nextStep)}</div>` : ''}
        <div class="mt-3 border-t border-gray-100 pt-2 font-medium text-gray-700">Tasks</div>
        ${list(reflection.tasks).length ? `<ul class="mt-1 space-y-1.5">${list(reflection.tasks).map((task: any) => { const title = typeof task === 'string' ? task : task?.title; task = typeof task === 'string' ? { title } : (task ?? {}); const icon = task.status === 'done' ? '✓' : task.status === 'doing' ? '●' : task.status === 'blocked' ? '!' : '○'; const color = task.status === 'done' ? 'text-green-600' : task.status === 'doing' ? 'text-blue-600' : task.status === 'blocked' ? 'text-red-600' : 'text-gray-400'; return `<li class="flex gap-2"><span class="${color}">${icon}</span><span class="min-w-0"><span class="text-gray-700">${esc(title)}</span>${task.nextStep ? `<div class="text-gray-400">${esc(task.nextStep)}</div>` : ''}</span></li>`; }).join('')}</ul>` : '<div class="mt-1 text-gray-400">No tasks extracted</div>'}
        ${reflection.reflectionNudge?.text ? `<div class="mt-3 rounded-md border border-violet-100 bg-violet-50 px-3 py-2.5"><div class="flex items-start gap-2"><div class="min-w-0 flex-1"><div class="text-[10px] font-semibold uppercase tracking-wide text-violet-500">Reflection nudge · ${Number(reflection.reflectionNudge.expiresAfterTurns ?? 3)} turns</div><div class="mt-1 text-violet-800">${esc(reflection.reflectionNudge.text)}</div>${reflection.reflectionNudge.reason ? `<div class="mt-1 text-violet-500">${esc(reflection.reflectionNudge.reason)}</div>` : ''}</div><button hx-post="/agent/${encodeURIComponent(agent.id)}/reflection-nudge/delete" hx-target="closest div.mt-3" hx-swap="outerHTML" title="Dismiss reflection nudge" aria-label="Dismiss reflection nudge" class="-mr-1 -mt-1 inline-flex size-6 shrink-0 items-center justify-center rounded text-violet-400 hover:bg-violet-100 hover:text-violet-700"><i class="ph ph-x"></i></button></div></div>` : ''}

        <div class="mt-3 border-t border-gray-100 pt-2"><span class="font-medium text-gray-700">User:</span> ${esc(reflection.userSatisfaction?.level ?? 'unknown')} · ${esc(reflection.userSatisfaction?.trend ?? 'unknown')}</div>
        ${list(reflection.userSatisfaction?.reasons).length ? `<ul class="mt-1 list-disc space-y-1 pl-4 text-gray-500">${list(reflection.userSatisfaction?.reasons).map((x: any) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        <div class="mt-3 border-t border-gray-100 pt-2 font-medium text-gray-700">Mistakes</div>
        ${list(reflection.mistakes).length ? `<ul class="mt-1 space-y-2">${list(reflection.mistakes).map((m: any) => typeof m === 'string' ? `<li><span class="text-gray-700">${esc(m)}</span></li>` : `<li><span class="text-gray-700">${esc(m.description)}</span><div class="text-gray-400">${esc(m.status)} · ${esc(m.lesson)}</div></li>`).join('')}</ul>` : '<div class="mt-1 text-gray-400">No significant mistakes noted</div>'}
      </div>
    </details>`;
}
