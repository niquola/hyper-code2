/** Creates or updates one Hacker News Algolia feed definition.
 * @param opts.key Stable lowercase key identifying the feed.
 * @param opts.label Human-readable feed label.
 * @param opts.query Algolia search query; empty for front-page mode.
 * @param opts.mode Algolia ordering and endpoint mode.
 * @param opts.enabled Whether bulk synchronization includes this feed.
 * @param opts.limit Default number of stories requested when sync omits a limit.
 */
export default async function(ctx:Context,_session:Session|null,opts:{/** Stable lowercase feed key. */key:string;/** Display label. */label:string;/** Algolia text query; empty for front page. */query?:string;/** Algolia mode. @default fresh */mode?:"front"|"fresh"|"top";/** Include feed in bulk sync. @default true */enabled?:boolean;/** Default number of stories requested for this feed. @default 20 @minimum 1 @maximum 1000 */limit?:number}):Promise<{key:string}>{await ctx.fns.procs.migrate.up({});if(!/^[a-z0-9_-]+$/.test(opts.key))throw new Error("hackernews.addFeed: invalid key");await ctx.fns.procs.db.run({sql:`INSERT INTO hackernews.feeds(key,label,query,mode,enabled,fetch_limit) VALUES(?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET label=excluded.label,query=excluded.query,mode=excluded.mode,enabled=excluded.enabled,fetch_limit=excluded.fetch_limit`,params:[opts.key,opts.label,opts.query??"",opts.mode??"fresh",opts.enabled!==false,Math.max(1,Math.min(1000,opts.limit??20))]});return{key:opts.key};}
