/** Lists news sources with archive and unread counts. */
export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<Array<{source:string;total:number;unread:number;latest:string|null}>> {
    await ctx.fns.news.ensure({});
    return ctx.fns.procs.db.select({sql:`SELECT source,count(*)::int total,count(*) FILTER(WHERE read_at IS NULL)::int unread,max(coalesce(shown_at,fetched_at)) latest FROM news.items GROUP BY source ORDER BY total DESC,source`,params:[]});
}
