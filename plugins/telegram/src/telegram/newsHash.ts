import{createHash}from"node:crypto";
/** Computes the stable normalized hash used to detect edited Telegram channel posts. */
export default function(_ctx:Context,_session:Session|null,opts:{
 /** Telegram channel peer identifier that owns the post. */ chat:string|number;
 /** Numeric Telegram message identifier within the channel. */ id:number;
 /** Current message text or media caption. */ text:string;
 /** Whether the message currently carries a photo. */ hasPhoto?:boolean;
 /** Telegram message timestamp used in normalized comparison. */ date?:string|number;
}):string{return createHash("sha256").update(JSON.stringify({chat:String(opts.chat),id:opts.id,text:String(opts.text??"").trim(),hasPhoto:opts.hasPhoto===true,date:opts.date??null})).digest("hex");}
