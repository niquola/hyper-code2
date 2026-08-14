// Run a DSL query (compile via db.sql, then select). Returns rows.
//   ctx.fns.procs.db.q({ select: "*", from: "todos", where: { done: 0 } })
/**
 * Compiles a query DSL object and executes it through the database select procedure.
 * @param query Parameterized SELECT query: table, columns, filters, ordering, and pagination.
 * @param query.select Columns to select, or `*` for all columns.
 * @param query.from Table to select from.
 * @param query.where Column filters to apply.
 * @param query.orderBy SQL ordering expression.
 * @param query.limit Maximum number of rows to return.
 * @param query.offset Number of rows to skip.
 */
export default async function (ctx: Context, _session: Session | null, query: types.procs.db.Query) {
    const { sql, params } = ctx.fns.procs.db.sql(query);
    return await ctx.fns.procs.db.select({ sql, params });
}
