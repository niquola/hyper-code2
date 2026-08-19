/** Creates or updates one Substack publication in the local catalogue.
 * @param opts.key Stable local publication key.
 * @param opts.name Human-readable publication name.
 * @param opts.host Canonical publication hostname.
 * @param opts.subdomain Substack subdomain when available.
 * @param opts.publicationId Numeric Substack publication identifier.
 * @param opts.enabled Whether bulk synchronization includes the publication.
 */
export default async function(ctx:Context,_session:Session|null,opts:{/** Stable publication key. */key:string;/** Publication name. */name:string;/** Publication hostname. */host:string;/** Substack subdomain when known. */subdomain?:string;/** Numeric Substack publication ID. */publicationId?:number;/** Include publication in bulk sync. @default true */enabled?:boolean}):Promise<{key:string}>{await ctx.fns.procs.migrate.up({});await ctx.fns.procs.db.run({sql:`INSERT INTO substack.publications(key,name,subdomain,host,publication_id,enabled) VALUES(?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET name=excluded.name,subdomain=excluded.subdomain,host=excluded.host,publication_id=excluded.publication_id,enabled=excluded.enabled`,params:[opts.key,opts.name,opts.subdomain??null,opts.host,opts.publicationId??null,opts.enabled!==false]});return{key:opts.key};}
