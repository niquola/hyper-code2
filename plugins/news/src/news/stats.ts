/** Returns compact durable news archive counts grouped by state. */
export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<{total:number;unread:number;liked:number;sources:number}> {
    await ctx.fns.news.ensure({});
    return (await ctx.fns.procs.db.select({sql:`SELECT count(*)::int total,count(*) FILTER(WHERE read_at IS NULL)::int unread,count(*) FILTER(WHERE liked_at IS NOT NULL)::int liked,count(DISTINCT source)::int sources FROM news.items`,params:[]}))[0];
}
