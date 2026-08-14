type SetOpts = {
    /** Setting namespace. */
    module: string;
    /** Scope category. */
    scopeType: string;
    /** Optional scope identifier. */
    scopeId?: string | null;
    /** Setting key to write. */
    key: string;
    /** JSON-serializable setting value. */
    value: any;
    /** Whether the stored row should be marked secret. */
    isSecret?: boolean;
};

/** Creates or updates one persisted setting override. */
export default async function (ctx: Context, _session: Session | null, opts: SetOpts): Promise<{ ok: true }> {
    const now = Date.now();
    await ctx.fns.procs.db.run({
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
