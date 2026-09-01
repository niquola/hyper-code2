const sql=`ALTER TABLE news.items ADD COLUMN IF NOT EXISTS image_url text;`;
export default{up:async(ctx:Context)=>{await ctx.fns.procs.db.exec({sql})},down:async(ctx:Context)=>{await ctx.fns.procs.db.exec({sql:"ALTER TABLE news.items DROP COLUMN IF EXISTS image_url"})}};
