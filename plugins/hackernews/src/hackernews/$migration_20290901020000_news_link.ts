const sql=`ALTER TABLE hackernews.stories ADD COLUMN IF NOT EXISTS news_id text;`;
export default{up:async(ctx:Context)=>{await ctx.fns.procs.db.exec({sql})},down:async(ctx:Context)=>{await ctx.fns.procs.db.exec({sql:"ALTER TABLE hackernews.stories DROP COLUMN IF EXISTS news_id"})}};
