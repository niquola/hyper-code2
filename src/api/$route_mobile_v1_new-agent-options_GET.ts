/** Returns model and workspace defaults for the native new-agent form. */
export default async function (ctx: Context, _session: Session | null, _opts: { req: Request; params: Record<string, string> }) {
    const [groups, defaultModel, agents] = await Promise.all([
        ctx.fns.llm.listModels({}),
        ctx.fns.settings.modelDefault({}),
        ctx.fns.session.list({ includeArchived: true }),
    ]);
    const models = Object.entries(groups).flatMap(([provider, values]) => values.map(model => ({ provider, model })));
    const workspaces = Array.from(new Set(agents.map(agent => agent.workspaceDir).filter(Boolean))).sort();
    return Response.json({ version: 1, defaultModel: defaultModel || models[0]?.model || "", models, workspaces });
}
