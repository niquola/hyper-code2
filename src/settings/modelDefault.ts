export default function (ctx: Context): string {
    return ctx.fns.settings?.getString?.(ctx, {
        module: 'llm',
        scopeType: 'global',
        key: 'defaultModel',
        fallback: ctx.env.MODEL ?? 'minimax/minimax-m2.7',
    }) ?? (ctx.env.MODEL ?? 'minimax/minimax-m2.7');
}
