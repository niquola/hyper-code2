/** Reads one canonical entity with provenance and incoming/outgoing graph relations. */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Stable `Type/slug` identifier. */ id: string;
    /** Include only provenance marked verified. @default false */ verifiedOnly?: boolean;
}): Promise<Record<string, any> | null> {
    await ctx.fns.knowledge.ensure({});
    const entity = (await ctx.fns.procs.db.select({ sql: "SELECT id,type,data,updated_at FROM knowledge.entities WHERE id=?", params: [opts.id] }))[0];
    if (!entity) return null;
    const provenance = await ctx.fns.procs.db.select({
        sql: `SELECT attribute,value,source,url,evidence,confidence,observed_at,status FROM knowledge.provenance
              WHERE subject=? ${opts.verifiedOnly ? "AND status='verified'" : ""} ORDER BY attribute,observed_at DESC NULLS LAST`,
        params: [opts.id],
    });
    const outgoing = await ctx.fns.procs.db.select({ sql: "SELECT predicate,object FROM knowledge.relations WHERE subject=? ORDER BY predicate,object", params: [opts.id] });
    const incoming = await ctx.fns.procs.db.select({ sql: "SELECT subject,predicate FROM knowledge.relations WHERE object=? ORDER BY predicate,subject", params: [opts.id] });
    return { ...entity, provenance, relations: { outgoing, incoming } };
}
