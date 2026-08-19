/** Explicitly syncs every enabled Telegram News channel in title order. */
export default async function(ctx:Context,_session:Session|null,opts:{
 /** Maximum recent messages inspected in each enabled channel. @default 50 @minimum 1 @maximum 500 */ max?:number;
}={}):Promise<any[]>{const out=[];for(const channel of await ctx.fns.telegram.newsChannels({enabled:true})){try{out.push(await ctx.fns.telegram.newsSyncChannel({chat:channel.chat_id,max:opts.max}))}catch(error:any){out.push({chatId:channel.chat_id,title:channel.title,error:String(error?.message??error)})}}return out;}
