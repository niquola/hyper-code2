/** Removes one RSS subscription and its locally stored entry and run state. */
export default async function(ctx:Context,_session:Session|null,opts:{
 /** Stable short feed key to remove from the catalogue. */ key:string;
}):Promise<{removed:boolean}>{await ctx.fns.rss.ensure({});const r=await ctx.fns.procs.db.run({sql:"DELETE FROM rss.feeds WHERE key=?",params:[opts.key]});return {removed:r.changes>0};}
