export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { id: string },
): Promise<{ cleared: boolean }> {
    const row = ((await ctx.fns.procs.db.select({
        sql: "SELECT reflection FROM agents WHERE id = ? AND archived_at IS NULL",
        params: [opts.id],
    })) as any[])[0];
    if (!row) throw new Error(`agent not found: ${opts.id}`);
    const reflection = row.reflection == null ? null : (typeof row.reflection === "string" ? JSON.parse(row.reflection) : row.reflection);
    if (!reflection?.state?.reflectionNudge) return { cleared: false };

    reflection.state.reflectionNudge = null;
    reflection.updatedAt = Date.now();
    await ctx.fns.procs.db.run({
        sql: "UPDATE agents SET reflection = ?::jsonb, updated_at = ? WHERE id = ?",
        params: [JSON.stringify(reflection), reflection.updatedAt, opts.id],
    });
    const agent = (ctx.state as any).agent?.[opts.id];
    if (agent) agent.reflection = reflection;
    return { cleared: true };
}
