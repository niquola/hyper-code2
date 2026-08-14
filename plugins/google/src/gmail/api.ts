// Generic Gmail API call: ctx.fns.gmail.api({ path: "/labels" })
// Base: https://gmail.googleapis.com/gmail/v1/users/me
/**
 * Call an arbitrary Gmail API endpoint.
 *
 * @param opts - Options for the operation.
 * @param opts.path - API-relative path or local destination path, as applicable.
 * @param opts.method - HTTP method; defaults to the operation-specific method.
 * @param opts.body - Request body or message body, as applicable.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (ctx: Context, session: Session | null, opts: { path: string; method?: string; body?: object; account?: string }) {
    const { access_token } = await ctx.fns.google.token({ account: opts.account });
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${opts.path}`, {
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
        throw new Error(`Gmail API ${res.status}: non-JSON response: ${text.slice(0, 200)}`);
    }
    if (!res.ok) throw new Error(`Gmail API ${res.status}: ${JSON.stringify(json)}`);
    return json;
}
