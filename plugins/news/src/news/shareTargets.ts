/** Lists share adapters registered through `$news_share_<target>.ts` declarations. */
export default async function(ctx:Context,_session:Session|null,_opts?:{}):Promise<Array<{target:string;label:string;icon:string;fn:string;destinationsFn:string}>>{return Object.values(((ctx.state as any).news?.shares??{})).sort((a:any,b:any)=>a.label.localeCompare(b.label)) as any[];}
