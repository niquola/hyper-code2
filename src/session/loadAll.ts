/** Load all for the runtime. */
export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<{ loaded: number }> {
    const ids = (await ctx.fns.procs.db.select({ sql: "SELECT id FROM agents ORDER BY updated_at DESC" })) as { id: string }[];
    (ctx.state as any).agent ??= {};
    let n = 0;
    for (const { id } of ids) {
        const agent = await ctx.fns.session.load({ id });
        if (agent) {
            (ctx.state as any).agent[id] = agent;
            n++;
        }
    }
    return { loaded: n };
}
