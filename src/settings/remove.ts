type RemoveOpts = {
    module: string;
    scopeType: string;
    scopeId?: string | null;
    key: string;
};

export default function (ctx: Context, opts: RemoveOpts): { ok: true } {
    ctx.fns.db.exec(ctx, {
        sql: `DELETE FROM settings
          WHERE module = ?
            AND scope_type = ?
            AND scope_id = ?
            AND key = ?`,
        params: [opts.module, opts.scopeType, opts.scopeId ?? '', opts.key],
    });
    return { ok: true };
}
