/** Creates one explicit typed relation between existing Knowledge entities. */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Existing source entity identifier in `Type/slug` form. */ subject: string;
    /** Stable relation predicate, such as `organization` or `link`. */ predicate: string;
    /** Existing target entity identifier in `Type/slug` form. */ object: string;
}): Promise<{ subject: string; predicate: string; object: string }> {
    await ctx.fns.knowledge.ensure({});
    const rows = await ctx.fns.procs.db.select({ sql: "SELECT id FROM knowledge.entities WHERE id IN (?,?)", params: [opts.subject, opts.object] });
    const known = new Set(rows.map((row: any) => row.id));
    if (!known.has(opts.subject)) throw new Error(`knowledge.link: unknown subject ${opts.subject}`);
    if (!known.has(opts.object)) throw new Error(`knowledge.link: unknown object ${opts.object}`);
    await ctx.fns.procs.db.run({ sql: "INSERT INTO knowledge.relations(subject,predicate,object) VALUES(?,?,?) ON CONFLICT DO NOTHING", params: [opts.subject, opts.predicate, opts.object] });
    return { subject: opts.subject, predicate: opts.predicate, object: opts.object };
}
