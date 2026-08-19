/** Explicitly synchronizes every enabled Substack publication.
 * @param opts.max Maximum recent archive posts inspected per publication.
 * @param opts.session Named authenticated Hyper Browser session.
 */
export default async function(ctx:Context,_session:Session|null,opts:{/** Maximum recent posts per publication. @default 30 @minimum 1 @maximum 500 */max?:number;/** Browser session name. @default substack */session?:string}={}):Promise<any[]>{const out=[];for(const p of(await ctx.fns.substack.list({})).filter((x:any)=>x.enabled)){try{out.push(await ctx.fns.substack.sync({key:p.key,max:opts.max,session:opts.session}))}catch(error:any){out.push({key:p.key,error:String(error?.message??error)})}}return out;}
