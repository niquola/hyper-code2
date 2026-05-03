export default function (
    ctx: Context,
    opts: { id: string; includeExcluded?: boolean },
): any[] {
    const { id, includeExcluded } = opts;
    const rows = ctx.fns.db.select<any>(ctx, { sql: 'SELECT id, parent_id, fork_offset FROM agents WHERE id = ?', params: [id] });
    const row = rows[0];
    if (!row) return [];

    const own = ctx.fns.session.getMessages(ctx, { id, includeExcluded });
    if (!row.parent_id) return own;

    const parent = ctx.fns.session.getFullMessages(ctx, { id: row.parent_id, includeExcluded });
    const limited = row.fork_offset == null ? parent : parent.slice(0, row.fork_offset);
    return [...limited, ...own];
}
