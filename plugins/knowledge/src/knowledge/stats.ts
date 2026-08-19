/** Returns compact storage and graph counts for the knowledge plugin. */
export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<{ entities: number; observations: number; relations: number; searchable: number }> {
    await ctx.fns.knowledge.ensure({});
    const row=(await ctx.fns.procs.db.select({sql:`SELECT (SELECT count(*)::int FROM knowledge.entities) entities,(SELECT count(*)::int FROM knowledge.provenance) observations,(SELECT count(*)::int FROM knowledge.relations) relations,(SELECT count(*)::int FROM knowledge.search) searchable`,params:[]}))[0];
    return row;
}
