export default function (ctx: Context): { loaded: number } {
    const ids = ctx.fns.db.select<{ id: string }>(ctx, { sql: "SELECT id FROM agents ORDER BY updated_at DESC" });
    (ctx.state as any).agent ??= {};
    let n = 0;
    for (const { id } of ids) {
        const agent = ctx.fns.session.load(ctx, { id });
        if (agent) {
            (ctx.state as any).agent[id] = agent;
            n++;
        }
    }
    return { loaded: n };
}
