/** Lists Telegram groups and broadcast channels available as News sharing destinations. */
export default async function(ctx:Context,_session:Session|null,_opts?:{}):Promise<Array<{id:string;label:string;kind:string}>>{return (await ctx.fns.telegram.dialogs({max:200})).filter((d:any)=>["channel","supergroup","group"].includes(d.type)).map((d:any)=>({id:String(d.id),label:d.title,kind:d.type}));}
