/** Lists RSS subscriptions with entry counts and latest explicit load state. */
export default async function(ctx:Context,_session:Session|null,opts:{
 /** When provided, include only enabled or disabled subscriptions. */ enabled?:boolean;
}={}):Promise<any[]>{await ctx.fns.rss.ensure({});return ctx.fns.procs.db.select({sql:`SELECT f.*,count(e.*)::int entries,count(e.*) FILTER(WHERE e.news_id IS NOT NULL)::int published,(SELECT status FROM rss.runs r WHERE r.feed_key=f.key ORDER BY started_at DESC LIMIT 1) last_status FROM rss.feeds f LEFT JOIN rss.entries e ON e.feed_key=f.key ${opts.enabled===undefined?"":`WHERE f.enabled=${opts.enabled?"true":"false"}`} GROUP BY f.key ORDER BY coalesce(f.category,''),f.label`,params:[]});}
