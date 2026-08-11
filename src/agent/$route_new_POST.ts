export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const form = await opts.req.formData();
    const title = String(form.get("title") ?? "").trim().slice(0, 120);
    const workspaceDir = await ctx.fns.workspace.normalize({ dir: String(form.get("workspaceDir") ?? "") });
    const model = (form.get("model") as string)?.trim()
        || (await ctx.fns.settings?.modelDefault?.({}))
        || ctx.env.MODEL
        || "minimax/minimax-m2.7";

    const presets = await ctx.fns.agent.listPromptPresets({});
    const selected = form.getAll("promptPreset")
        .map(x => String(x))
        .filter(id => Object.prototype.hasOwnProperty.call(presets, id));

    const presetText = selected
        .map(id => (presets as Record<string, { text?: string }>)[id]?.text?.trim())
        .filter(Boolean)
        .join("\n\n");

    const systemPromptRaw = (form.get("systemPrompt") as string)?.trim() || "";
    const systemPrompt = [presetText, systemPromptRaw].filter(Boolean).join("\n\n");

    const agent = await ctx.fns.agent.start({ model, title, workspaceDir, systemPrompt });
    // The next "+" preselects this — picking a model once is picking a default.
    await ctx.fns.procs.db.run({
        sql: "INSERT INTO kv (key, value) VALUES ('last-model', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
        params: [model],
    }).catch(() => {});
    return new Response(null, { status: 303, headers: { location: `/agent/${encodeURIComponent(agent.id)}` } });
}