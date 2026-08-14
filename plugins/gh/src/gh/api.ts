// Generic GitHub REST API call. Authentication stays private: environment first,
// then the local `gh auth token` keyring integration. This function never returns
// or logs the token. Non-GET methods require confirm:true.
/** Resolve and cache a GitHub access token without exposing it to callers.
 * @param ctx Runtime context containing environment and plugin state.
 * @returns The authenticated GitHub access token.
 */
async function accessToken(ctx: Context): Promise<string> {
    const cache = ((ctx.state as any).gh ??= {} as { token?: string });
    if (cache.token) return cache.token;
    const env = ctx.env.GH_TOKEN || ctx.env.GITHUB_TOKEN;
    if (env) return cache.token = env;
    const proc = Bun.spawn(["gh", "auth", "token"], { stdout: "pipe", stderr: "pipe" });
    const [stdout, _stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
    const token = stdout.trim();
    if (code !== 0 || !token) throw new Error("GitHub authentication unavailable. Run `gh auth login` or set GH_TOKEN.");
    return cache.token = token;
}

/** Call a GitHub REST API endpoint using authenticated credentials.
 * @param ctx Runtime context.
 * @param _session Unused session supplied by the procedural runtime.
 * @param opts Request options.
 * @returns The decoded JSON response, text response, or `null` for HTTP 204.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** HTTP method and GitHub API path, for example `GET /repos/{owner}/{repo}`. */
        route: string;
        /** Values substituted into `{name}` placeholders in the route path. */
        path?: Record<string, string | number>;
        /** Query-string parameters appended to the request URL. */
        params?: Record<string, string | number | boolean>;
        /** JSON-serializable request body. */
        body?: any;
        /** Additional HTTP headers; these may override the defaults. */
        headers?: Record<string, string>;
        /** Requested page size, clamped to GitHub's range of 1 through 100. */
        per_page?: number;
        /** One-based result page to request. */
        page?: number;
        /** Must be `true` for methods other than GET and HEAD. */
        confirm?: boolean;
    },
): Promise<any> {
    const match = String(opts?.route ?? "").match(/^([A-Z]+)\s+(\/[^\s]*)$/);
    if (!match) throw new Error("gh.api: route must be like GET /repos/{owner}/{repo}");
    const method = match[1]!;
    let path = match[2]!;
    if (!/^(GET|HEAD)$/.test(method) && opts.confirm !== true) throw new Error(`gh.api ${method} is a real write; repeat with confirm: true after explicit user approval`);
    if (opts.path) for (const [name, value] of Object.entries(opts.path)) path = path.replaceAll(`{${name}}`, encodeURIComponent(String(value)));
    if (/\{[^}]+\}/.test(path)) throw new Error("gh.api: unresolved route parameter");

    const url = new URL(`https://api.github.com${path}`);
    if (opts.per_page) url.searchParams.set("per_page", String(Math.min(100, Math.max(1, opts.per_page))));
    if (opts.page) url.searchParams.set("page", String(opts.page));
    if (opts.params) for (const [name, value] of Object.entries(opts.params)) url.searchParams.set(name, String(value));
    const token = await accessToken(ctx);
    const res = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
            ...opts.headers,
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 204) return null;
    const text = await res.text();
    let json: any;
    try { json = text ? JSON.parse(text) : null; }
    catch { if (!res.ok) throw new Error(`GitHub API ${res.status}: non-JSON response`); return text; }
    if (!res.ok) throw new Error(`GitHub API ${res.status}: ${json?.message ?? "request failed"}`);
    return json;
}
