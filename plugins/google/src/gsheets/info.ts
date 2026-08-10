// Spreadsheet metadata: title + tabs with dimensions.
// ctx.fns.gsheets.info({ id: "1Bxi..." })
export default async function (ctx: Context, session: Session | null, opts: { id: string; account?: string }) {
    if (!opts?.id) throw new Error("gsheets.info: id is required");
    const result = await ctx.fns.gsheets.api({
        path: `/spreadsheets/${opts.id}?fields=spreadsheetId,properties.title,sheets(properties)`,
        account: opts.account,
    });
    return {
        id: result.spreadsheetId,
        title: result.properties?.title,
        sheets: (result.sheets || []).map((s: any) => ({
            id: s.properties.sheetId,
            title: s.properties.title,
            rowCount: s.properties.gridProperties?.rowCount || 0,
            colCount: s.properties.gridProperties?.columnCount || 0,
        })),
    };
}
