// Read cell values from a range (A1 notation). Default range: A:Z (whole first sheet).
// ctx.fns.gsheets.read({ id: "1Bxi...", range: "Sheet1!A1:D10" })
/**
 * Read values from a spreadsheet range.
 *
 * @param opts - Options for the operation.
 * @param opts.id - Resource identifier.
 * @param opts.range - Spreadsheet range in A1 notation.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (ctx: Context, session: Session | null, opts: { id: string; range?: string; account?: string }) {
    if (!opts?.id) throw new Error("gsheets.read: id is required");
    const range = opts.range ?? "A:Z";
    const result = await ctx.fns.gsheets.api({
        path: `/spreadsheets/${opts.id}/values/${encodeURIComponent(range)}`,
        account: opts.account,
    });
    return {
        spreadsheetId: opts.id,
        sheetName: range.split("!")[0] || "Sheet1",
        range: result.range || range,
        values: result.values || [],
    };
}
