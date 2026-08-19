/**
 * Creates or merges one canonical typed knowledge entity.
 * Use for normalized people, organizations, products, concepts, schema definitions, and other `Type/slug` entities.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Stable `Type/slug` identifier. */ id: string;
    /** Canonical JSON facts merged over existing data. */ data: Record<string, any>;
    /** Replace all canonical data rather than merging unspecified fields. @default false */ replace?: boolean;
    /** Refresh this entity's searchable projection. @default true */ rebuild?: boolean;
}): Promise<{ id: string; type: string; data: Record<string, any> }> {
    await ctx.fns.knowledge.ensure({});
    const id = String(opts.id ?? "").trim();
    const match = /^([A-Za-z][\w-]*)\/([\w.@-]+)$/.exec(id);
    if (!match) throw new Error("knowledge.upsert: id must be Type/slug");
    const type = match[1]!;
    const old = (await ctx.fns.procs.db.select({ sql: "SELECT data FROM knowledge.entities WHERE id = ?", params: [id] }))[0]?.data ?? {};
    const data = opts.replace ? opts.data : { ...old, ...opts.data };
    await ctx.fns.procs.db.run({
        sql: `INSERT INTO knowledge.entities(id,type,data,updated_at) VALUES(?,?,?::jsonb,now())
              ON CONFLICT(id) DO UPDATE SET type=excluded.type,data=excluded.data,updated_at=now()`,
        params: [id, type, JSON.stringify(data)],
    });
    if (opts.rebuild !== false) await ctx.fns.knowledge.rebuildSearch({ ids: [id] });
    return { id, type, data };
}
