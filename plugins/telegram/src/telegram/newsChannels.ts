/** Lists configured Telegram News channels with cursor and imported-post counts. */
export default async function(ctx:Context,_session:Session|null,opts:{
 /** When provided, include only enabled or disabled News channels. */ enabled?:boolean;
}={}):Promise<any[]>{await ctx.fns.procs.migrate.up({});return ctx.fns.procs.db.select({sql:`SELECT c.*,count(p.*)::int posts,count(p.*) FILTER(WHERE p.news_id IS NOT NULL)::int published FROM telegram.news_channels c LEFT JOIN telegram.news_posts p ON p.chat_id=c.chat_id ${opts.enabled===undefined?"":`WHERE c.enabled=${opts.enabled?"true":"false"}`} GROUP BY c.chat_id ORDER BY c.title`,params:[]});}
