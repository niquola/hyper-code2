// Overwrite a range with a 2D array of values (USER_ENTERED — formulas/numbers parsed).
// ctx.fns.gsheets.write({ id, range: "Sheet1!A1", values: [["Name","Age"],["Alice","30"]] })
export default async function (
    ctx: Context,
    session: Session | null,
    opts: { id: string; range: string; values: any[][]; account?: string },
) {
    if (!opts?.id || !opts?.range || !opts?.values) throw new Error("gsheets.write: id, range, values are required");
    const result = await ctx.fns.gsheets.api({
        path: `/spreadsheets/${opts.id}/values/${encodeURIComponent(opts.range)}?valueInputOption=USER_ENTERED`,
        method: "PUT",
        body: { values: opts.values },
        account: opts.account,
    });
    return { updatedCells: result.updatedCells || 0, updatedRange: result.updatedRange || opts.range };
}
