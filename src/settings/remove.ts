type RemoveOpts = {
    module: string;
    scopeType: string;
    scopeId?: string | null;
    key: string;
};

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
