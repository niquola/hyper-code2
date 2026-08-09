export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<string> {
    return (await ctx.fns.settings?.getString?.({
        module: 'llm',
        scopeType: 'global',
        key: 'defaultModel',
        fallback: ctx.env.MODEL ?? 'minimax/minimax-m2.7',
    })) ?? (ctx.env.MODEL ?? 'minimax/minimax-m2.7');
}
