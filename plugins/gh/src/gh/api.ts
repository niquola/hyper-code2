// Generic GitHub REST API call. Authentication stays private: environment first,
// then the local `gh auth token` keyring integration. This function never returns
// or logs the token. Non-GET methods require confirm:true.
async function accessToken(ctx: Context) {
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

export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        route: string;
        path?: Record<string, string | number>;
        params?: Record<string, string | number | boolean>;
        body?: any;
        headers?: Record<string, string>;
        per_page?: number;
        page?: number;
        confirm?: boolean;
    },
) {
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
