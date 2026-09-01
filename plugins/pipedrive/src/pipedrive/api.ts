/**
 * Calls one documented Pipedrive REST API v1 read endpoint. This transport is
 * deliberately GET-only so agents cannot mutate CRM data through an escape hatch.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** API path beginning with `/`, such as `/deals/123`. */
        path: string;
        /** Query parameters; null/undefined values are omitted. */
        params?: Record<string, string | number | boolean | undefined | null>;
    },
): Promise<any> {
    const path = String(opts.path ?? "").trim();
    if (!path.startsWith("/") || path.includes("..")) throw new Error("pipedrive.api: path must be an absolute safe API path");
    const [domain, token] = await Promise.all([
        ctx.fns.secrets.resolveSetting({ module: "pipedrive", scopeType: "global", key: "domain" }),
        ctx.fns.secrets.resolveSetting({ module: "pipedrive", scopeType: "global", key: "apiToken" }),
    ]);
    if (!domain || !token) throw new Error("pipedrive credentials are not configured; set pipedrive.domain and pipedrive.apiToken");
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(domain)) throw new Error("pipedrive.domain must be a company subdomain, not a URL");
    const url = new URL(`https://${domain}.pipedrive.com/api/v1${path}`);
    for (const [key, value] of Object.entries(opts.params ?? {})) if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    url.searchParams.set("api_token", token);
    const response = await fetch(url, { headers: { accept: "application/json" } });
    const text = await response.text();
    let body: any;
    try { body = JSON.parse(text); } catch { body = text; }
    if (!response.ok || body?.success === false) throw new Error(`Pipedrive API ${response.status} ${path}: ${body?.error ?? String(body).slice(0, 300)}`);
    return body?.data;
}
