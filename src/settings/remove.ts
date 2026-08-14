type RemoveOpts = {
    /** Setting namespace. */
    module: string;
    /** Scope category. */
    scopeType: string;
    /** Optional scope identifier. */
    scopeId?: string | null;
    /** Setting key to remove. */
    key: string;
};

/** Removes one persisted setting override. */
export default async function (ctx: Context, _session: Session | null, opts: RemoveOpts): Promise<{ ok: true }> {
    await ctx.fns.procs.db.run({
        sql: `DELETE FROM settings
          WHERE module = ?
            AND scope_type = ?
            AND scope_id = ?
            AND key = ?`,
        params: [opts.module, opts.scopeType, opts.scopeId ?? '', opts.key],
    });
    return { ok: true };
}
