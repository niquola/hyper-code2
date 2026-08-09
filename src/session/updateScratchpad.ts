export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { id: string; scratchpad: Record<string, any>; ts?: number },
): Promise<{ ok: boolean }> {
    const { id, scratchpad } = opts;
    const ts = opts.ts ?? Date.now();
    const res = await ctx.fns.procs.db.run({
        sql: `
        UPDATE agents
        SET scratchpad = ?, updated_at = ?
        WHERE id = ?
    `,
        params: [JSON.stringify(scratchpad ?? {}), ts, id],
    });
    return { ok: res.changes > 0 };
}
