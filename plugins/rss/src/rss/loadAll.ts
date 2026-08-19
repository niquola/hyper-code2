/** Explicitly loads every enabled RSS subscription in catalogue order. */
export default async function(ctx:Context,_session:Session|null,opts:{
 /** Maximum newest entries processed for each feed. @default 30 @minimum 1 @maximum 200 */ limit?:number;
 /** Store parsed entry state without publishing entries to News. @default false */ dryRun?:boolean;
}={}):Promise<Array<Record<string,any>>>{const out:any[]=[];for(const feed of await ctx.fns.rss.list({enabled:true})){try{out.push(await ctx.fns.rss.load({key:feed.key,limit:opts.limit,dryRun:opts.dryRun}))}catch(error:any){out.push({key:feed.key,error:String(error?.message??error)})}}return out;}
