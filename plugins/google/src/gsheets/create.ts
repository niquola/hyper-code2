// Create a new spreadsheet with optional named tabs (default one tab "Sheet1").
// ctx.fns.gsheets.create({ title: "Q1 Report", sheets: ["Revenue","Expenses"] })
/**
 * Create a Google spreadsheet.
 *
 * @param opts - Options for the operation.
 * @param opts.title - Resource title.
 * @param opts.sheets - Initial sheet names to create.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: { title: string; sheets?: string[]; account?: string },
) {
    if (!opts?.title) throw new Error("gsheets.create: title is required");
    const sheets = opts.sheets?.length
        ? opts.sheets.map(name => ({ properties: { title: name } }))
        : [{ properties: { title: "Sheet1" } }];
    const result = await ctx.fns.gsheets.api({
        path: "/spreadsheets",
        method: "POST",
        body: { properties: { title: opts.title }, sheets },
        account: opts.account,
    });
    return { id: result.spreadsheetId, title: result.properties?.title, link: result.spreadsheetUrl };
}
