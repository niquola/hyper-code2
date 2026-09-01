/** Sends one prepared News item to a Telegram group or channel after explicit confirmation. */
export default async function(ctx:Context,_session:Session|null,opts:{
 /** Stored News item supplied by `news.share`. */ item:Record<string,any>;
 /** Telegram chat identifier. */ destination:string;
 /** Optional replacement text. */ text?:string;
 /** Explicit approval for the Telegram write. */ confirm:boolean;
 /** Stable idempotency identifier supplied by News. */ idempotencyKey:string;
}):Promise<{ref:string;url?:string;sentAt:string}>{if(opts.confirm!==true)throw new Error("telegram.shareNews requires confirm: true");const item=opts.item??{},text=(opts.text?.trim()||[item.title,item.summary,item.url].filter(Boolean).join("\n\n")).slice(0,4096);if(!text)throw new Error("telegram.shareNews: empty message");const sent=await ctx.fns.telegram.send({chat:opts.destination,text,confirm:true});const internal=String(opts.destination).replace(/^-100/,""),url=String(opts.destination).startsWith("-100")?`https://t.me/c/${internal}/${sent.id}`:undefined;return{ref:String(sent.id),url,sentAt:sent.date};}
