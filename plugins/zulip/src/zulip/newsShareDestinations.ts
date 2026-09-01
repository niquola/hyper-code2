/** Lists Health Samurai Zulip channels available as News sharing destinations. */
export default async function(ctx:Context,_session:Session|null,_opts?:{}):Promise<Array<{id:string;label:string;kind:string}>>{return (await ctx.fns.zulip.channels({instance:"hs"})).map((channel:any)=>({id:String(channel.name),label:channel.name,kind:"channel · topic news"}));}
