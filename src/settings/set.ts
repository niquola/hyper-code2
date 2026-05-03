type SetOpts = {
    module: string;
    scopeType: string;
    scopeId?: string | null;
    key: string;
    value: any;
    isSecret?: boolean;
};

export default function (ctx: Context, opts: SetOpts): { ok: true } {
    const now = Date.now();
    ctx.fns.db.exec(ctx, {
        sql: `INSERT INTO settings (module, scope_type, scope_id, key, value, is_secret, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(module, scope_type, scope_id, key)
         DO UPDATE SET
            value = excluded.value,
            is_secret = excluded.is_secret,
            updated_at = excluded.updated_at`,
        params: [
            opts.module,
            opts.scopeType,
            opts.scopeId ?? '',
            opts.key,
            JSON.stringify(opts.value),
            opts.isSecret ? 1 : 0,
            now,
        ],
    });
    return { ok: true };
}
