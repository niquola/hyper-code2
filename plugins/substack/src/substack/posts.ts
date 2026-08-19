/** Lists mirrored posts for one Substack publication.
 * @param opts.key Stable publication key.
 * @param opts.limit Maximum mirrored posts returned.
 */
export default async function(ctx:Context,_session:Session|null,opts:{/** Stable publication key. */key:string;/** Maximum posts. @default 30 @minimum 1 @maximum 200 */limit?:number}):Promise<any[]>{return ctx.fns.procs.db.select({sql:"SELECT * FROM substack.posts WHERE publication_key=? ORDER BY published_at DESC NULLS LAST LIMIT ?",params:[opts.key,Math.max(1,Math.min(200,opts.limit??30))]});}
