type ListOpts = {
    /** Restricts results to a setting namespace. */
    module?: string;
    /** Restricts results to a scope category. */
    scopeType?: string;
    /** Restricts results to a scope identifier. */
    scopeId?: string | null;
};

/** Lists persisted settings matching optional scope filters. */
export default async function (ctx: Context, _session: Session | null, opts: ListOpts = {}): Promise<Array<{
    module: string;
    scopeType: string;
    scopeId: string;
    key: string;
    value: any;
    isSecret: boolean;
    updatedAt: number;
}>> {
    const where: string[] = [];
    const params: any[] = [];

    if (opts.module != null) {
        where.push('module = ?');
        params.push(opts.module);
    }
    if (opts.scopeType != null) {
        where.push('scope_type = ?');
        params.push(opts.scopeType);
    }
    if (opts.scopeId != null) {
        where.push('scope_id = ?');
        params.push(opts.scopeId ?? '');
    }

    const rows = await ctx.fns.procs.db.select({
        sql: `SELECT module, scope_type, scope_id, key, value, is_secret, updated_at
           FROM settings${where.length ? ' WHERE ' + where.join(' AND ') : ''}
          ORDER BY module, scope_type, scope_id, key`,
        params,
    });

    return rows.map((row: any) => ({
        module: row.module,
        scopeType: row.scope_type,
        scopeId: row.scope_id,
        key: row.key,
        value: JSON.parse(row.value),
        isSecret: !!row.is_secret,
        updatedAt: row.updated_at,
    }));
}
