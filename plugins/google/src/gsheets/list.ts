// List Google Spreadsheets via the Drive API (most-recently-modified first).
// ctx.fns.gsheets.list({ query: "budget", max: 20 })
export default async function (ctx: Context, session: Session | null, opts?: { query?: string; max?: number; account?: string }) {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("pageSize", String(opts?.max ?? 20));
    url.searchParams.set("orderBy", "modifiedTime desc");
    url.searchParams.set("fields", "files(id,name,modifiedTime,webViewLink)");
    let q = "mimeType='application/vnd.google-apps.spreadsheet'";
    if (opts?.query) q += ` and name contains '${opts.query.replace(/'/g, "\\'")}'`;
    url.searchParams.set("q", q);

    const result = await ctx.fns.gsheets.api({ url: url.toString(), account: opts?.account });
    return (result.files || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        modified: f.modifiedTime,
        link: f.webViewLink,
    }));
}
