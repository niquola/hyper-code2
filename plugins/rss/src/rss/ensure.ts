/** Ensures the isolated RSS library schema exists. */
export default async function(ctx:Context,_session:Session|null,_opts?:{}):Promise<void>{await ctx.fns.procs.migrate.up({});}
