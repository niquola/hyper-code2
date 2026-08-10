// Generic Google Workspace Admin SDK Directory API call.
// Base: https://admin.googleapis.com/admin/directory/v1
//   ctx.fns.gworkspace.api({ path: "/users?domain=health-samurai.io" })
// Needs admin.directory.* scopes (run google.reauth once) AND the account must be a
// Workspace admin — otherwise 403 "Not Authorized to access this resource/api".
export default async function (ctx: Context, _session: Session | null, opts: { path: string; method?: string; body?: object; account?: string }) {
    const { access_token } = await ctx.fns.google.token({ account: opts.account });
    const res = await fetch(`https://admin.googleapis.com/admin/directory/v1${opts.path}`, {
        method: opts.method ?? "GET",
        headers: { Authorization: `Bearer ${access_token}`, ...(opts.body ? { "Content-Type": "application/json" } : {}) },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { throw new Error(`Directory API ${res.status}: ${text.slice(0, 200)}`); }
    if (!res.ok) throw new Error(`Directory API ${res.status}: ${JSON.stringify(json)}`);
    return json;
}
