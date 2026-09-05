/**
 * Returns the lineage root agent id whose transcript prefix a fork shares for prompt caching
 *
 * Walks parentId links while the agent inherits parent history (fork offset null or non-zero, matching session.getFullMessages) and returns the topmost ancestor id. Use as the provider prompt cache key so a transcript-sharing fork reuses the parent's cached prefix; agents without inherited history return their own id.
 * @param opts.agent Live agent whose cache lineage is resolved.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Live agent whose cache lineage is resolved. */
        agent: types.agent.Agent;
    },
): Promise<string> {
    let current: any = opts.agent;
        const seen = new Set<string>();
        while (current?.parentId && current.forkOffset !== 0 && !seen.has(current.id)) {
            seen.add(current.id);
            const parent = (ctx.state as any).agent?.[current.parentId] ?? await ctx.fns.session.load({ id: current.parentId }).catch(() => null);
            if (!parent) break;
            current = parent;
        }
        return String(current?.id ?? opts.agent.id);
}
