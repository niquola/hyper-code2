type GetOpts = {
    module: string;
    scopeType: string;
    scopeId?: string | null;
    key: string;
};

export default function (ctx: Context, opts: GetOpts): any {
    const row = ctx.fns.db.select<{ value: string }>(ctx,
        `SELECT value
           FROM settings
          WHERE module = ?
            AND scope_type = ?
            AND scope_id = ?
            AND key = ?`,
        [opts.module, opts.scopeType, opts.scopeId ?? '', opts.key],
    )[0];

    if (!row) return undefined;
    return JSON.parse(row.value);
}
