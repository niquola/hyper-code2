// The reflection state is written by a model, and rows written before any
// given validation was added keep whatever shape they had. A view over stored
// data must not throw: `list()` is the only way this file reads a collection,
// so a string where an array was promised renders as one item instead of
// taking the whole agent page down with `.map is not a function`.
const list = (v: any): any[] => Array.isArray(v) ? v : (typeof v === "string" && v.trim() ? [v.trim()] : []);

/** Render a resilient, top-layer conversation-reflection panel anchored to its toolbar trigger. */
/**
 * Render stored reflection activity, tasks, satisfaction and mistakes without failing on legacy scalar list fields.
 * @param opts.agent Agent associated with the operation.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Agent associated with the operation. */ agent: types.agent.Agent }): Promise<string> {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const agent = opts.agent;
    const reflection = agent.reflection?.state ?? null;
    const running: Set<string> | undefined = (ctx.state as any).reflectionRuns;
    const active = !!running?.has(agent.id);
    const liveAttrs = `id="reflection-${esc(agent.id)}" hx-get="/agent/${encodeURIComponent(agent.id)}/reflection" hx-trigger="hyper-live from:body, every 60s" hx-target="this" hx-swap="outerHTML" data-live-topic="agent:${esc(agent.id)}"`;

    const buttonClass = 'inline-flex size-7 items-center justify-center rounded-md border transition focus:outline-none focus:ring-2 focus:ring-primary/30';

    if (active) return `<span ${liveAttrs} class="${buttonClass} border-primary/30 bg-primary/10 text-primary" title="Reflection is running" aria-label="Reflection is running"><i class="ph ph-brain animate-spin" aria-hidden="true"></i></span>`;
    if (!reflection) return `<span ${liveAttrs} class="${buttonClass} border-base-300 bg-base-100 text-base-content/40" title="Reflection appears after 3 user messages" aria-label="Reflection pending"><i class="ph ph-brain" aria-hidden="true"></i></span>`;

    const contentHtml = `<div class="mb-2 text-[10px] font-semibold uppercase tracking-wide text-base-content/40">What we are doing</div>
        <div class="font-medium text-base-content">${esc(reflection.activity?.goal ?? 'Unknown')}</div>
        <div class="mt-1 text-base-content/70">${esc(reflection.activity?.currentStep ?? '')}</div>
        ${reflection.activity?.nextStep ? `<div class="mt-2 text-base-content/60"><span class="font-medium">Next:</span> ${esc(reflection.activity.nextStep)}</div>` : ''}
        <div class="mt-3 border-t border-base-200 pt-2 font-medium text-base-content/80">Tasks</div>
        ${list(reflection.tasks).length ? `<ul class="mt-1 space-y-1.5">${list(reflection.tasks).map((task: any) => { const title = typeof task === 'string' ? task : task?.title; task = typeof task === 'string' ? { title } : (task ?? {}); const icon = task.status === 'done' ? '✓' : task.status === 'doing' ? '●' : task.status === 'blocked' ? '!' : '○'; const color = task.status === 'done' ? 'text-success' : task.status === 'doing' ? 'text-blue-600' : task.status === 'blocked' ? 'text-red-600' : 'text-base-content/40'; return `<li class="flex gap-2"><span class="${color}">${icon}</span><span class="min-w-0"><span class="text-base-content/80">${esc(title)}</span>${task.nextStep ? `<div class="text-base-content/40">${esc(task.nextStep)}</div>` : ''}</span></li>`; }).join('')}</ul>` : '<div class="mt-1 text-base-content/40">No tasks extracted</div>'}
        ${reflection.reflectionNudge?.text ? `<div class="mt-3 rounded-md border border-ui-border bg-base-200 px-3 py-2.5"><div class="flex items-start gap-2"><div class="min-w-0 flex-1"><div class="text-[10px] font-semibold uppercase tracking-wide text-base-content/55">Reflection nudge · ${Number(reflection.reflectionNudge.expiresAfterTurns ?? 3)} turns</div><div class="mt-1 text-base-content/80">${esc(reflection.reflectionNudge.text)}</div>${reflection.reflectionNudge.reason ? `<div class="mt-1 text-base-content/55">${esc(reflection.reflectionNudge.reason)}</div>` : ''}</div><button hx-post="/agent/${encodeURIComponent(agent.id)}/reflection-nudge/delete" hx-target="closest div.mt-3" hx-swap="outerHTML" title="Dismiss reflection nudge" aria-label="Dismiss reflection nudge" class="-mr-1 -mt-1 inline-flex size-6 shrink-0 items-center justify-center rounded text-violet-400 hover:bg-base-300 hover:text-base-content"><i class="ph ph-x"></i></button></div></div>` : ''}

        <div class="mt-3 border-t border-base-200 pt-2"><span class="font-medium text-base-content/80">User:</span> ${esc(reflection.userSatisfaction?.level ?? 'unknown')} · ${esc(reflection.userSatisfaction?.trend ?? 'unknown')}</div>
        ${list(reflection.userSatisfaction?.reasons).length ? `<ul class="mt-1 list-disc space-y-1 pl-4 text-base-content/60">${list(reflection.userSatisfaction?.reasons).map((x: any) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        <div class="mt-3 border-t border-base-200 pt-2 font-medium text-base-content/80">Mistakes</div>
        ${list(reflection.mistakes).length ? `<ul class="mt-1 space-y-2">${list(reflection.mistakes).map((m: any) => typeof m === 'string' ? `<li><span class="text-base-content/80">${esc(m)}</span></li>` : `<li><span class="text-base-content/80">${esc(m.description)}</span><div class="text-base-content/40">${esc(m.status)} · ${esc(m.lesson)}</div></li>`).join('')}</ul>` : '<div class="mt-1 text-base-content/40">No significant mistakes noted</div>'}
`;
    const popup = await ctx.fns.ui.inplacePopup({
        id: `reflection-popover-${agent.id}`,
        triggerHtml: '<i class="ph ph-brain" aria-hidden="true"></i>',
        triggerAttrs: `class="${buttonClass} border-primary/30 bg-primary/10 text-primary hover:bg-primary/20" title="Conversation reflection" aria-label="Open conversation reflection"`,
        panelAttrs: 'aria-label="Conversation reflection"',
        contentHtml,
    });
    return `<span ${liveAttrs} class="inline-flex">${popup}</span>`;
}
