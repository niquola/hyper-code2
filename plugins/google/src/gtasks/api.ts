// Generic Google Tasks API call: ctx.fns.gtasks.api({ path: "/users/@me/lists" })
// Base: https://tasks.googleapis.com/tasks/v1
export default async function (ctx: Context, session: Session | null, opts: { path: string; method?: string; body?: object; account?: string }) {
    const { access_token } = await ctx.fns.google.token({ account: opts.account });
    const res = await fetch(`https://tasks.googleapis.com/tasks/v1${opts.path}`, {
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
        throw new Error(`Tasks API ${res.status}: non-JSON response: ${text.slice(0, 200)}`);
    }
    if (!res.ok) throw new Error(`Tasks API ${res.status}: ${JSON.stringify(json)}`);
    return json;
}
