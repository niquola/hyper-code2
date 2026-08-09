export default function (ctx: Context, _session: Session | null, _opts?: {}): string {
    return ctx.fns.settings?.getString?.({
        module: 'llm',
        scopeType: 'global',
        key: 'defaultModel',
        fallback: ctx.env.MODEL ?? 'minimax/minimax-m2.7',
    }) ?? (ctx.env.MODEL ?? 'minimax/minimax-m2.7');
}
