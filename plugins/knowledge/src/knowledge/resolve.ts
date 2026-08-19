/** Rebuilds graph relations from attributes declared as reference-valued schema entities. */
export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<{ referenceAttributes: string[]; relations: number }> {
    await ctx.fns.knowledge.ensure({});
    const definitions = await ctx.fns.procs.db.select({ sql: "SELECT id,data FROM knowledge.entities WHERE type='Attribute'", params: [] });
    const refs = new Set<string>(definitions.filter((row: any) => row.data?.datatype === "ref").map((row: any) => String(row.id).split("/")[1]).filter((name: string | undefined): name is string => Boolean(name)));
    await ctx.fns.procs.db.run({ sql: "TRUNCATE knowledge.relations", params: [] });
    let relations = 0;
    for (const row of await ctx.fns.procs.db.select({ sql: "SELECT id,data FROM knowledge.entities", params: [] })) {
        for (const [predicate, value] of Object.entries(row.data ?? {})) {
            if (!refs.has(predicate)) continue;
            for (const object of Array.isArray(value) ? value : [value]) {
                if (typeof object !== "string" || !/^[A-Za-z][\w-]*\/[\w.@-]+$/.test(object)) continue;
                await ctx.fns.procs.db.run({ sql: "INSERT INTO knowledge.relations(subject,predicate,object) VALUES(?,?,?) ON CONFLICT DO NOTHING", params: [row.id, predicate, object] });
                relations++;
            }
        }
    }
    return { referenceAttributes: [...refs].sort(), relations };
}
