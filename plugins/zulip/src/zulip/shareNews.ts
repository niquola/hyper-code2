/** Sends one prepared News item to a Health Samurai Zulip channel under the `news` topic. */
export default async function(ctx:Context,_session:Session|null,opts:{
 /** Stored News item supplied by `news.share`. */ item:Record<string,any>;
 /** Health Samurai Zulip channel name. */ destination:string;
 /** Optional replacement message text. */ text?:string;
 /** Explicit approval for the Zulip write. */ confirm:boolean;
 /** Stable idempotency identifier supplied by News. */ idempotencyKey:string;
}):Promise<{ref:string;url?:string;sentAt:string}>{if(opts.confirm!==true)throw new Error("zulip.shareNews requires confirm: true");const item=opts.item??{},content=(opts.text?.trim()||[`**${item.title??"News"}**`,item.summary,item.url?`[Original](${item.url})`:null].filter(Boolean).join("\n\n")).slice(0,10000);if(!content)throw new Error("zulip.shareNews: empty message");const sent=await ctx.fns.zulip.send({channel:opts.destination,topic:"news",content,instance:"hs"});return{ref:String(sent.id),sentAt:new Date().toISOString()};}
