/** Sets or toggles the liked state for one stored news item. */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Stable identifier of the item whose liked state changes. */ id:string;
    /** Explicit desired state; omit to toggle the current value. */ liked?:boolean;
}): Promise<{id:string;liked:boolean}> {
    await ctx.fns.news.ensure({}); const row=(await ctx.fns.procs.db.select({sql:"SELECT liked_at FROM news.items WHERE id=?",params:[opts.id]}))[0]; if(!row)throw new Error(`news.setLiked: no item ${opts.id}`);
    const liked=opts.liked??!row.liked_at; await ctx.fns.procs.db.run({sql:`UPDATE news.items SET liked_at=${liked?"now()":"NULL"} WHERE id=?`,params:[opts.id]}); return {id:opts.id,liked};
}
