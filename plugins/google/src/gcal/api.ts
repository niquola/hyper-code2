// Generic Google Calendar API call: ctx.fns.gcal.api({ path: "/users/me/calendarList" })
// Base: https://www.googleapis.com/calendar/v3
// `query` is an object of querystring params (auto URL-encoded).
export default async function (
    ctx: Context,
    session: Session | null,
    opts: { path: string; method?: string; body?: object; query?: Record<string, string | number | boolean | undefined>; account?: string },
) {
    const { access_token } = await ctx.fns.google.token({ account: opts.account });
    const url = new URL(`https://www.googleapis.com/calendar/v3${opts.path}`);
    for (const [k, v] of Object.entries(opts.query ?? {})) {
        if (v !== undefined) url.searchParams.set(k, String(v));
    }
    const res = await fetch(url.toString(), {
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
        throw new Error(`Calendar API ${res.status}: non-JSON response: ${text.slice(0, 200)}`);
    }
    if (!res.ok) throw new Error(`Calendar API ${res.status}: ${JSON.stringify(json)}`);
    return json;
}
