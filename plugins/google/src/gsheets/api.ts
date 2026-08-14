// Generic Google API call for gsheets module. Two hosts are used:
//   - Sheets API:  https://sheets.googleapis.com/v4   (default base)
//   - Drive API:   https://www.googleapis.com/drive/v3 (for listing spreadsheets)
// Pass `url` (absolute) to hit any host, or `path` to append to the Sheets v4 base.
//   ctx.fns.gsheets.api({ path: "/spreadsheets/<id>" })
//   ctx.fns.gsheets.api({ url: "https://www.googleapis.com/drive/v3/files?..." })
/**
 * Call an arbitrary Google Sheets API endpoint.
 *
 * @param opts - Options for the operation.
 * @param opts.url - URL used by the operation.
 * @param opts.path - API-relative path or local destination path, as applicable.
 * @param opts.method - HTTP method; defaults to the operation-specific method.
 * @param opts.body - Request body or message body, as applicable.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: { url?: string; path?: string; method?: string; body?: object; account?: string },
) {
    const { access_token } = await ctx.fns.google.token({ account: opts.account });
    const url = opts.url ?? `https://sheets.googleapis.com/v4${opts.path}`;
    const res = await fetch(url, {
        method: opts.method ?? "GET",
        headers: {
            Authorization: `Bearer ${access_token}`,
            ...(opts.body ? { "Content-Type": "application/json" } : {}),
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch {
        throw new Error(`Google API ${res.status}: non-JSON response: ${text.slice(0, 200)}`);
    }
    if (!res.ok) throw new Error(`Google API ${res.status}: ${JSON.stringify(json)}`);
    return json;
}
