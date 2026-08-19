/** Lists Substack publications with mirrored post counts and cursor state. */
export default async function(ctx:Context,_session:Session|null,_opts?:{}):Promise<any[]>{return ctx.fns.procs.db.select({sql:`SELECT p.*,count(s.*)::int posts FROM substack.publications p LEFT JOIN substack.posts s ON s.publication_key=p.key GROUP BY p.key ORDER BY p.name`,params:[]});}
