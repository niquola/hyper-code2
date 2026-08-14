// Search Drive files. Defaults to Google Docs only; pass mime:"" or a raw `q` for any file type.
// `query` is a plain substring matched against file name UNLESS it already looks like a Drive query
//   (contains "contains" / "=" / ">" / "<"), in which case it is passed through verbatim.
// Drive query language: https://developers.google.com/drive/api/guides/search-files
// ctx.fns.gdoc.search({ query: "budget" })                 // docs named *budget*
// ctx.fns.gdoc.search({ query: "report", docsOnly: false }) // any file named *report*
// ctx.fns.gdoc.search({ query: "mimeType='application/pdf'", docsOnly: false })
/**
 * Search Google Drive for documents.
 *
 * @param opts - Options for the operation.
 * @param opts.query - Search query.
 * @param opts.max - Maximum number of results to return.
 * @param opts.docsOnly - Whether to restrict Drive search results to Google Docs.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts?: { query?: string; max?: number; docsOnly?: boolean; account?: string },
) {
    const max = opts?.max ?? 20;
    const docsOnly = opts?.docsOnly ?? true;
    const raw = opts?.query ?? "";
    const isRawQuery = /contains|[=<>]/.test(raw);

    const clauses: string[] = [];
    if (docsOnly) clauses.push("mimeType='application/vnd.google-apps.document'");
    if (raw) clauses.push(isRawQuery ? raw : `name contains '${raw.replace(/'/g, "\\'")}'`);
    const q = clauses.join(" and ");

    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("pageSize", String(max));
    url.searchParams.set("orderBy", "modifiedTime desc");
    url.searchParams.set("fields", "files(id,name,mimeType,modifiedTime,webViewLink,size,owners)");
    if (q) url.searchParams.set("q", q);

    const result = await ctx.fns.gdoc.api({ url: url.toString(), account: opts?.account });
    return (result.files || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        modified: f.modifiedTime,
        link: f.webViewLink,
        size: f.size ? parseInt(f.size) : undefined,
        owner: f.owners?.[0]?.emailAddress,
    }));
}
