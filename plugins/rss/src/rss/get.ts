/** Reads one RSS subscription with its recent entries and explicit load runs. */
export default async function(ctx:Context,_session:Session|null,opts:{
 /** Stable short feed key from the RSS catalogue. */ key:string;
 /** Maximum recent stored entries returned. @default 50 @minimum 1 @maximum 200 */ limit?:number;
}):Promise<any>{await ctx.fns.rss.ensure({});const feed=(await ctx.fns.procs.db.select({sql:"SELECT * FROM rss.feeds WHERE key=?",params:[opts.key]}))[0];if(!feed)return null;const limit=Math.max(1,Math.min(200,opts.limit??50));const [entries,runs]=await Promise.all([ctx.fns.procs.db.select({sql:"SELECT * FROM rss.entries WHERE feed_key=? ORDER BY published_at DESC NULLS LAST,last_seen_at DESC LIMIT ?",params:[opts.key,limit]}),ctx.fns.procs.db.select({sql:"SELECT * FROM rss.runs WHERE feed_key=? ORDER BY started_at DESC LIMIT 20",params:[opts.key]})]);return {...feed,entries,runs};}
