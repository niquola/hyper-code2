/** Lists mirrored Hacker News stories, optionally within one feed.
 * @param opts.feed Configured feed key used to filter membership.
 * @param opts.limit Maximum mirrored stories returned.
 */
export default async function(ctx:Context,_session:Session|null,opts:{/** Optional configured feed key. */feed?:string;/** Maximum stories. @default 30 @minimum 1 @maximum 200 */limit?:number}={}):Promise<any[]>{const limit=Math.max(1,Math.min(200,opts.limit??30));return ctx.fns.procs.db.select({sql:opts.feed?`SELECT s.*,fs.rank FROM hackernews.feed_stories fs JOIN hackernews.stories s ON s.id=fs.story_id WHERE fs.feed_key=? ORDER BY fs.rank NULLS LAST,s.points DESC LIMIT ?`:`SELECT * FROM hackernews.stories ORDER BY created_at DESC NULLS LAST LIMIT ?`,params:opts.feed?[opts.feed,limit]:[limit]});}
