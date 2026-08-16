/**
 * Renders the provider and model picker for an existing chat
 *
 * Returns standard popup content listing configured model routes by provider, with controls that switch the selected live agent through the existing model endpoint. Use as the lazy popup target behind the provider icon in a chat header.
 * @param opts.agentId Identifier of the live or persisted agent whose provider and model can be changed.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Identifier of the live or persisted agent whose provider and model can be changed. */
        agentId: string;
    },
): Promise<Response> {
    const id = String(opts.agentId ?? '').trim();
    if (!id) return new Response('agentId is required', { status: 400 });
    const agent = (ctx.state as any).agent?.[id] ?? await ctx.fns.session.load({ id });
    if (!agent) return new Response('agent not found', { status: 404 });
    
    const esc = (value: unknown) => ctx.fns.procs.ui.escape({ text: String(value ?? '') });
    const current = String(agent.model ?? '');
    const currentProvider = (/^([a-z][\w-]*)(?:\/[\w.-]+)?:/.exec(current)?.[1] ?? 'lmstudio');
    const listed = await ctx.fns.llm.listModels({});
    const groups: Record<string, string[]> = {};
    for (const [provider, models] of Object.entries(listed ?? {})) {
        const values = Array.from(new Set((models ?? []).map(String).filter(Boolean)));
        if (values.length) groups[provider] = values;
    }
    if (current && !Object.values(groups).some(models => models.includes(current))) {
        (groups[currentProvider] ??= []).unshift(current);
    }
    
    const labels: Record<string, string> = {
        'claude-code': 'Claude Code',
        'anthropic-oauth': 'Anthropic OAuth',
        anthropic: 'Anthropic API',
        codex: 'Codex',
        openai: 'OpenAI API',
        openrouter: 'OpenRouter',
        'kimi-coding': 'Kimi Coding',
        kimi: 'Kimi API',
        groq: 'Groq',
        lmstudio: 'LM Studio',
    };
    const entries = Object.entries(groups).sort(([a], [b]) => {
        if (a === currentProvider) return -1;
        if (b === currentProvider) return 1;
        return (labels[a] ?? a).localeCompare(labels[b] ?? b);
    });
    const providerNav = entries.map(([provider, models], index) => {
        const selected = provider === currentProvider;
        const html = `${ctx.fns.ui.modelLogo({ model: models[0] ?? provider + ':?', bare: true, compact: true })}<span class="truncate">${esc(labels[provider] ?? provider)}</span><span class="ml-auto text-[10px] text-base-content/35">${models.length}</span>`;
        return ctx.fns.procs.ui.button({ action: 'select-model-provider', html, ariaLabel: `Show ${labels[provider] ?? provider} models`, class: `flex w-full items-center gap-2 rounded-lg text-left text-xs ${selected ? 'bg-primary/10 font-medium text-primary' : 'text-base-content/60'}`, attrs: { 'data-model-provider-tab': true, 'aria-selected': selected, onclick: `const root=this.closest('[data-model-picker]');root.querySelectorAll('[data-model-provider-tab]').forEach((tab,i)=>{const on=i===${index};tab.setAttribute('aria-selected',String(on));tab.classList.toggle('bg-primary/10',on);tab.classList.toggle('font-medium',on);tab.classList.toggle('text-primary',on);tab.classList.toggle('text-base-content/60',!on)});root.querySelectorAll('[data-model-provider-panel]').forEach((panel,i)=>panel.classList.toggle('hidden',i!==${index}))` } });
    }).join('');
    const modelGroups = entries.map(([provider, models]) => {
        const rows = models.map(model => {
            const selected = model === current;
            const modelId = model.includes(':') ? model.slice(model.indexOf(':') + 1) : model;
            const html = `<span class="min-w-0 flex-1"><span class="block truncate text-xs font-medium">${esc(modelId)}</span><span class="block truncate font-mono text-[9px] text-base-content/35">${esc(model)}</span></span>${selected ? '<i class="ph ph-check-circle text-primary" aria-hidden="true"></i>' : '<i class="ph ph-arrow-right text-base-content/25" aria-hidden="true"></i>'}`;
            return `<form hx-post="/agent/${encodeURIComponent(id)}/model" hx-swap="none" class="contents"><input type="hidden" name="model" value="${esc(model)}">${ctx.fns.procs.ui.button({ action: 'select-model', html, type: 'submit', disabled: selected, class: `flex w-full items-center gap-2 rounded-lg text-left ${selected ? 'border-primary/30 bg-primary/10 text-primary' : 'text-base-content/70'}`, attrs: selected ? { 'aria-current': 'true' } : {} })}</form>`;
        }).join('');
        return `<section data-model-provider-panel class="${provider === currentProvider ? '' : 'hidden '}min-h-0"><div class="mb-2 flex items-center gap-2"><h3 class="text-xs font-semibold text-base-content/80">${esc(labels[provider] ?? provider)}</h3><span class="text-[10px] text-base-content/35">${models.length} models</span></div><div class="grid gap-1.5">${rows}</div></section>`;
    }).join('');
    const html = entries.length
        ? `<div data-model-picker class="grid min-h-0 grid-cols-1 gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]"><nav aria-label="Providers" class="max-h-[55vh] space-y-1 overflow-auto border-b border-ui-border pb-3 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3">${providerNav}</nav><div class="max-h-[55vh] overflow-auto pr-1">${modelGroups}</div></div><p class="mt-3 border-t border-ui-border pt-2 text-[10px] text-base-content/40">The next model call uses the selected route; chat history stays unchanged.</p>`
        : '<div class="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-base-content/60">No configured model providers are available.</div>';
    return new Response(ctx.fns.ui.popupContent({ title: 'Provider and model', kind: 'model-picker', class: 'w-full max-w-2xl', html }), { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
