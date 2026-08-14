// Append rows after the last row of a table within the given range (INSERT_ROWS).
// ctx.fns.gsheets.append({ id, range: "Sheet1!A:B", values: [["Bob","25"]] })
/**
 * Append values to a spreadsheet range.
 *
 * @param opts - Options for the operation.
 * @param opts.id - Resource identifier.
 * @param opts.range - Spreadsheet range in A1 notation.
 * @param opts.values - Two-dimensional array of cell values.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: { id: string; range: string; values: any[][]; account?: string },
) {
    if (!opts?.id || !opts?.range || !opts?.values) throw new Error("gsheets.append: id, range, values are required");
    const result = await ctx.fns.gsheets.api({
        path: `/spreadsheets/${opts.id}/values/${encodeURIComponent(opts.range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        method: "POST",
        body: { values: opts.values },
        account: opts.account,
    });
    return { updatedCells: result.updates?.updatedCells || 0, updatedRange: result.updates?.updatedRange || opts.range };
}
