/** Marks one or more stored news items read or unread. */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Stable identifiers of items whose reader state changes. */ ids:string[];
    /** True marks read; false restores unread state. @default true */ read?:boolean;
}): Promise<{updated:number}> {
    await ctx.fns.news.ensure({}); if(!opts.ids?.length)return {updated:0};
    const result=await ctx.fns.procs.db.run({sql:`UPDATE news.items SET read_at=${opts.read===false?"NULL":"coalesce(read_at,now())"} WHERE id IN (${opts.ids.map(()=>"?").join(",")})`,params:opts.ids});
    return {updated:result.changes};
}
