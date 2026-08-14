/** Update scratchpad for the runtime. */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Agent identifier. */
    id: string;
        /** Scratchpad state to persist. */
    scratchpad: Record<string, any>;
        /** Ts used by the operation. */
    ts?: number },
): Promise<{ ok: boolean }> {
    const { id, scratchpad } = opts;
    const ts = opts.ts ?? Date.now();
    const res = await ctx.fns.procs.db.run({
        sql: `
        UPDATE agents
        SET scratchpad = ?, updated_at = ?
        WHERE id = ?
    `,
        params: [JSON.stringify(scratchpad ?? {}).replaceAll('\u0000', '\uFFFD'), ts, id],
    });
    return { ok: res.changes > 0 };
}
