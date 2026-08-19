/** Lists configured Hacker News feeds with mirrored story counts. */
export default async function(ctx:Context,_session:Session|null,_opts?:{}):Promise<any[]>{await ctx.fns.procs.migrate.up({});return ctx.fns.procs.db.select({sql:`SELECT f.*,count(fs.*)::int stories FROM hackernews.feeds f LEFT JOIN hackernews.feed_stories fs ON fs.feed_key=f.key GROUP BY f.key ORDER BY f.key`,params:[]});}
