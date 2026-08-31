/**
 * Calls the official Consensus REST API using the configured secret API key.
 * Use for stable documented paper search; browser cookies are not involved.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Official API path. @default "/v1/search" */
        path?: string;
        /** Query parameters accepted by the endpoint. */
        query: Record<string, string | number | boolean | string[] | undefined>;
    },
): Promise<any> {
    const apiKey = await ctx.fns.secrets.resolveSetting({ module: "research", scopeType: "global", key: "apiKey" });
    if (!apiKey) throw new Error("research API key is not configured; create one at https://consensus.app/api-mcp/ and set research.apiKey or CONSENSUS_API_KEY");
    const path = String(opts.path ?? "/v1/search");
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(opts.query ?? {})) {
        if (value === undefined) continue;
        if (Array.isArray(value)) for (const item of value) params.append(key, item);
        else params.set(key, String(value));
    }
    const response = await fetch(`https://api.consensus.app${path}?${params}`, { headers: { "x-api-key": apiKey, accept: "application/json" } });
    const text = await response.text();
    let body: any;
    try { body = JSON.parse(text); } catch { body = text; }
    if (!response.ok) throw new Error(`Consensus API ${response.status}: ${typeof body === "string" ? body.slice(0, 400) : JSON.stringify(body).slice(0, 400)}`);
    return body;
}
