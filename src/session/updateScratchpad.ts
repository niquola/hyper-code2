export default function (
    ctx: Context,
    id: string,
    scratchpad: Record<string, any>,
    ts = Date.now(),
): { ok: boolean } {
    const res = ctx.fns.db.exec(ctx, `
        UPDATE agents
        SET scratchpad = ?, updated_at = ?
        WHERE id = ?
    `, [JSON.stringify(scratchpad ?? {}), ts, id]);
    return { ok: res.changes > 0 };
}
