// Generic Google API call (Docs + Drive share one OAuth token).
// `url` is a FULL url because gdoc touches several hosts:
//   https://www.googleapis.com/drive/v3/files
//   https://docs.googleapis.com/v1/documents/<id>
// ctx.fns.gdoc.api({ url: "https://docs.googleapis.com/v1/documents/<id>" })
/**
 * Call an arbitrary Google Docs or Drive API endpoint.
 *
 * @param opts - Options for the operation.
 * @param opts.url - URL used by the operation.
 * @param opts.method - HTTP method; defaults to the operation-specific method.
 * @param opts.body - Request body or message body, as applicable.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (ctx: Context, session: Session | null, opts: { url: string; method?: string; body?: object; account?: string }) {
    const { access_token } = await ctx.fns.google.token({ account: opts.account });
    const res = await fetch(opts.url, {
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
    if (!res.ok) throw new Error(`Google API ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
    return json;
}
