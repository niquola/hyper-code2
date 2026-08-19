/** Explicitly synchronizes every enabled Hacker News feed.
 * @param opts.limit Maximum Algolia hits processed for each enabled feed.
 */
export default async function(ctx:Context,_session:Session|null,opts:{/** Maximum hits requested per feed. @default 100 @minimum 1 @maximum 1000 */limit?:number}={}):Promise<any[]>{const out=[];for(const feed of(await ctx.fns.hackernews.listFeeds({})).filter((x:any)=>x.enabled)){try{out.push(await ctx.fns.hackernews.sync({feed:feed.key,limit:opts.limit}))}catch(error:any){out.push({feed:feed.key,error:String(error?.message??error)})}}return out;}
