export default function (ctx: Context, id: string): any[] {
    const rows = ctx.fns.db.select<any>(ctx, 'SELECT id, parent_id, fork_offset FROM agents WHERE id = ?', [id]);
    const row = rows[0];
    if (!row) return [];
    const own = ctx.fns.session.getMessages(ctx, id);
    if (!row.parent_id) return own;
    const parent = ctx.fns.session.getFullMessages(ctx, row.parent_id);
    const limited = row.fork_offset == null ? parent : parent.slice(0, row.fork_offset);
    return [...limited, ...own];
}
