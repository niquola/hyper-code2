export default function (
    ctx: Context,
    _session: Session | null,
    opts: { id: string; includeExcluded?: boolean },
): any[] {
    const { id, includeExcluded } = opts;
    const rows = ctx.fns.procs.db.select({ sql: 'SELECT id, parent_id, fork_offset FROM agents WHERE id = ?', params: [id] }) as any[];
    const row = rows[0];
    if (!row) return [];

    const own = ctx.fns.session.getMessages({ id, includeExcluded });
    if (!row.parent_id) return own;

    const parent = ctx.fns.session.getFullMessages({ id: row.parent_id, includeExcluded });
    const limited = row.fork_offset == null ? parent : parent.slice(0, row.fork_offset);
    return [...limited, ...own];
}
