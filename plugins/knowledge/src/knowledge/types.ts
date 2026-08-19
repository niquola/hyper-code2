/** Lists canonical entity types and counts stored by the knowledge plugin. */
export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<Array<{ type: string; count: number }>> {
    await ctx.fns.knowledge.ensure({});
    return ctx.fns.procs.db.select({ sql: "SELECT type,count(*)::int AS count FROM knowledge.entities GROUP BY type ORDER BY type", params: [] });
}
