/** Start for the runtime.  * @param opts.model Model identifier to use.
 * @param opts.title Human-readable agent title.
 * @param opts.workspaceDir Workspace directory assigned to the agent.
 * @param opts.systemPrompt Additional system instructions.
 * @param opts.parentId Optional parent agent identifier.
 * @param opts.forkOffset Optional inherited parent transcript offset.
*/
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Model identifier. */
    model: string;
        /** Human-readable title. */
    title?: string;
        /** Workspace dir used by the operation. */
    workspaceDir?: string;
        /** Additional system instructions. */
    systemPrompt?: string;
        /** Parent id used by the operation. */
    parentId?: string | null;
        /** Fork offset used by the operation. */
    forkOffset?: number | null },
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
        statusLine: "",
        statusLineEvery: 1,
        reflection: null,
        forkOffset: opts.forkOffset ?? null,
        sleepContext: null,
        currentJobId: null,
        reflectionEnabled: false,
        sleepEnabled: false,
        goal: null,
        drainPromise: null,
        wakeAt: null,
        wakeReason: null,
    };
    (ctx.state as any).agent ??= {};
    (ctx.state as any).agent[id] = agent;
    await ctx.fns.session?.save?.({ agent });
    ctx.fns.events?.emitAgentsChanged?.({ agentId: agent.id, reason: "create" });
    return agent;
}
