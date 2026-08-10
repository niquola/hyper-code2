export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { model: string; title?: string; workspaceDir?: string; systemPrompt?: string; parentId?: string | null; forkOffset?: number | null },
): Promise<types.agent.Agent> {
    const id = await ctx.fns.agent.nextId({});
    const workspaceDir = opts.workspaceDir
        ? await ctx.fns.workspace.normalize({ dir: opts.workspaceDir })
        : process.cwd();
    const agent: types.agent.Agent = {
        id,
        model: opts.model,
        title: String(opts.title ?? "").trim().slice(0, 120),
        workspaceDir,
        systemPrompt: opts.systemPrompt ?? "",
        messages: [],
        events: [],
        cursors: {},
        subscribers: new Set(),
        waiters: [],
        isStreaming: false,
        abortController: null,
        scratchpad: {},
        parentId: opts.parentId ?? null,
        forkOffset: opts.forkOffset ?? null,
        currentJobId: null,
        drainPromise: null,
    };
    (ctx.state as any).agent ??= {};
    (ctx.state as any).agent[id] = agent;
    await ctx.fns.session?.save?.({ agent });
    ctx.fns.events?.emitAgentsChanged?.({ agentId: agent.id, reason: "create" });
    return agent;
}
