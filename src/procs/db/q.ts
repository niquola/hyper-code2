// Run a DSL query (compile via db.sql, then select). Returns rows.
//   ctx.fns.procs.db.q({ select: "*", from: "todos", where: { done: 0 } })
export default function (ctx: Context, _session: Session | null, query: types.procs.db.Query) {
    const { sql, params } = ctx.fns.procs.db.sql(query);
    return ctx.fns.procs.db.select({ sql, params });
}
