export default function (
    ctx: Context,
    id: string,
    scratchpad: Record<string, any>,
    ts = Date.now(),
): { ok: boolean } {
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
