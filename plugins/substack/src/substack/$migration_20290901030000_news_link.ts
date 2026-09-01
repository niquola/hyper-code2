const sql=`ALTER TABLE substack.posts ADD COLUMN IF NOT EXISTS news_id text;`;
export default{up:async(ctx:Context)=>{await ctx.fns.procs.db.exec({sql})},down:async(ctx:Context)=>{await ctx.fns.procs.db.exec({sql:"ALTER TABLE substack.posts DROP COLUMN IF EXISTS news_id"})}};
