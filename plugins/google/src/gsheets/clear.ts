// Clear cell values in a range (keeps formatting). Destructive — empties cells.
// ctx.fns.gsheets.clear({ id, range: "Sheet1!A2:Z" })
/**
 * Clear values from a spreadsheet range.
 *
 * @param opts - Options for the operation.
 * @param opts.id - Resource identifier.
 * @param opts.range - Spreadsheet range in A1 notation.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (ctx: Context, session: Session | null, opts: { id: string; range: string; account?: string }) {
    if (!opts?.id || !opts?.range) throw new Error("gsheets.clear: id and range are required");
    const result = await ctx.fns.gsheets.api({
        path: `/spreadsheets/${opts.id}/values/${encodeURIComponent(opts.range)}:clear`,
        method: "POST",
        body: {},
        account: opts.account,
    });
    return { clearedRange: result.clearedRange || opts.range };
}
