/** Reads one stored news item by its stable source identifier. */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Stable identifier assigned by the source producer. */ id: string;
}): Promise<Record<string, any> | null> {
    await ctx.fns.news.ensure({});
    return (await ctx.fns.procs.db.select({sql:"SELECT * FROM news.items WHERE id=?",params:[opts.id]}))[0] ?? null;
}
