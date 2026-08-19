/** Lists stored news with source, read, liked and text filters. */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Restrict to one source. */ source?: string;
    /** Restrict to unread items. */ unread?: boolean;
    /** Restrict to liked items. */ liked?: boolean;
    /** Search title and stored summaries. */ query?: string;
    /** Maximum rows. @default 30 @minimum 1 @maximum 100 */ limit?: number;
    /** Result offset. @default 0 @minimum 0 */ offset?: number;
} = {}): Promise<any[]> {
    await ctx.fns.news.ensure({});
    const where:string[]=[],params:any[]=[];
    if(opts.source){where.push("source=?");params.push(opts.source)}
    if(opts.unread===true)where.push("read_at IS NULL"); else if(opts.unread===false)where.push("read_at IS NOT NULL");
    if(opts.liked)where.push("liked_at IS NOT NULL");
    if(opts.query?.trim()){where.push("search_vector @@ websearch_to_tsquery('simple',?)");params.push(opts.query.trim())}
    const limit=Math.max(1,Math.min(100,Math.floor(opts.limit??30))),offset=Math.max(0,Math.floor(opts.offset??0));
    params.push(limit,offset);
    return ctx.fns.procs.db.select({sql:`SELECT id,title,url,author,points,comments,topics,summary,summary_long,source,fetched_at,shown_at,liked_at,read_at,reposts FROM news.items ${where.length?`WHERE ${where.join(" AND ")}`:""} ORDER BY coalesce(shown_at,fetched_at) DESC LIMIT ? OFFSET ?`,params});
}
