/** Adds or updates one broadcast channel in the Telegram-owned News producer catalogue. */
export default async function(ctx:Context,_session:Session|null,opts:{
 /** Telegram channel peer identifier such as `-100123`. */ chat:string|number;
 /** Display title used as the News author and headline. */ title:string;
 /** Optional Telegram folder identifier that discovered the channel. */ folderId?:number;
 /** Include this channel in bulk sync. @default true */ enabled?:boolean;
}):Promise<{chatId:string}>{await ctx.fns.procs.migrate.up({});const chatId=String(opts.chat);await ctx.fns.procs.db.run({sql:`INSERT INTO telegram.news_channels(chat_id,title,folder_id,enabled,updated_at) VALUES(?,?,?,?,now()) ON CONFLICT(chat_id) DO UPDATE SET title=excluded.title,folder_id=coalesce(excluded.folder_id,telegram.news_channels.folder_id),enabled=excluded.enabled,updated_at=now()`,params:[chatId,opts.title,opts.folderId??null,opts.enabled!==false]});return {chatId};}
