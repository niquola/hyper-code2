/** Resolves the UI debounce interval for an agent. */
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Agent whose scoped value is resolved. */ /** Identifier of the agent whose scoped setting is used. */ agentId: string;
        /** Default interval in milliseconds. */ /** Fallback value when the setting is absent. */ fallback?: number }): Promise<number> {
    const fallback = opts.fallback ?? 5000;
    return (await ctx.fns.settings?.getNumber?.({
        module: 'ui',
        scopeType: 'agent',
        scopeId: opts.agentId,
        key: 'debounceMs',
        fallback,
    })) ?? fallback;
}
