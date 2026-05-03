export default function (
    ctx: Context,
    opts: { id: string; scratchpad: Record<string, any>; ts?: number },
): { ok: boolean } {
    const { id, scratchpad } = opts;
    const ts = opts.ts ?? Date.now();
    const res = ctx.fns.db.exec(ctx, {
        sql: `
        UPDATE agents
        SET scratchpad = ?, updated_at = ?
        WHERE id = ?
    `,
        params: [JSON.stringify(scratchpad ?? {}), ts, id],
    });
    return { ok: res.changes > 0 };
}
