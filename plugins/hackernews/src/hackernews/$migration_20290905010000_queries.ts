const sql=`ALTER TABLE hackernews.feeds ADD COLUMN IF NOT EXISTS queries text[];`;
export default{up:async(ctx:Context)=>{await ctx.fns.procs.db.exec({sql})},down:async(ctx:Context)=>{await ctx.fns.procs.db.exec({sql:"ALTER TABLE hackernews.feeds DROP COLUMN IF EXISTS queries"})}};
