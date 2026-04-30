export default async function (ctx: Context, id: string) {
    const pending = ((ctx.state as any).uiEval ??= { pending: new Map() });
    return pending.pending.get(id) ?? null;
}
