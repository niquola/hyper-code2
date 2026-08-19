/** Validates canonical entities against required fields declared by their storage and mixin classes. */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Validate only this `Type/slug` entity. */ id?: string;
} = {}): Promise<{ count: number; violations: Array<{ id: string; class: string; missing: string }> }> {
    await ctx.fns.knowledge.ensure({});
    const definitions = await ctx.fns.procs.db.select({ sql: "SELECT id,data FROM knowledge.entities WHERE type='Entity'", params: [] });
    const required = new Map(definitions.map((row: any) => [row.id, Array.isArray(row.data?.required) ? row.data.required : row.data?.required ? [row.data.required] : []]));
    const rows = await ctx.fns.procs.db.select({ sql: `SELECT id,type,data FROM knowledge.entities ${opts.id ? "WHERE id=?" : ""}`, params: opts.id ? [opts.id] : [] });
    const violations: Array<{ id: string; class: string; missing: string }> = [];
    for (const row of rows) {
        const classes = [`Entity/${row.type}`, ...(Array.isArray(row.data?.type) ? row.data.type : row.data?.type ? [row.data.type] : [])];
        for (const cls of classes) for (const field of required.get(cls) ?? []) {
            const value = row.data?.[field];
            if (value == null || value === "" || (Array.isArray(value) && !value.length)) violations.push({ id: row.id, class: cls, missing: field });
        }
    }
    return { count: violations.length, violations };
}
