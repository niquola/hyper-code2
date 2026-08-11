// Generic Zulip REST call. Credentials are read privately from 1Password and
// never cross the function boundary. GET uses query; POST/PATCH use form data.
async function opRead(ref: string) {
    const paths = [process.env.PATH, `${process.env.HOME}/.local/bin`, "/opt/homebrew/bin", "/usr/local/bin"].filter(Boolean).join(":");
    const proc = Bun.spawn(["op", "read", ref, "--no-newline"], {
        env: { ...process.env, PATH: paths }, stdout: "pipe", stderr: "pipe",
    });
    const [stdout, stderr, code] = await Promise.all([
        new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited,
    ]);
    if (code !== 0) throw new Error(`Zulip credentials: 1Password CLI failed (${code}): ${stderr.trim().slice(0, 240)}`);
    return stdout.trim();
}

async function resolveConfig(ctx: Context, requested?: string) {
    const all = await ctx.fns.zulip.creds({ list: true });
    let instance = requested ?? ctx.env.ZULIP_INSTANCE;
    if (!instance) {
        if (all.length === 1) instance = all[0]!;
        else throw new Error(`Specify instance. Configured: ${all.join(", ") || "none"} (or set ZULIP_INSTANCE)`);
    }
    const selected = instance as string;
    if (!/^[a-zA-Z0-9._-]+$/.test(selected)) throw new Error(`Invalid Zulip instance: ${selected}`);
    if (!all.includes(selected)) throw new Error(`Unknown Zulip instance: ${selected}. Configured: ${all.join(", ") || "none"}`);

    const state = ((ctx.state as any).zulip ??= { creds: {}, instances: all });
    if (state.creds?.[selected]) return state.creds[selected];
    state.creds ??= {};
    const vault = ctx.env.ZULIP_OP_VAULT || "hyper";
    const prefix = ctx.env.ZULIP_OP_ITEM_PREFIX || "zulip ";
    let cfg: any;
    try { cfg = JSON.parse(await opRead(`op://${vault}/${prefix}${selected}.json/value`)); }
    catch (error: any) {
        throw new Error(`Could not resolve Zulip credentials for ${selected}: ${String(error?.message ?? error)}`);
    }
    if (!cfg?.url || !cfg?.email || !cfg?.apiKey) throw new Error(`Zulip credentials for ${selected} require url, email and apiKey`);
    return state.creds[selected] = {
        name: String(cfg.name ?? selected), url: String(cfg.url).replace(/\/$/, ""),
        email: String(cfg.email), apiKey: String(cfg.apiKey),
    };
}

export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { path: string; method?: string; query?: Record<string, string>; form?: Record<string, string>; instance?: string },
) {
    if (!opts?.path) throw new Error("zulip.api: path required");
    const cfg = await resolveConfig(ctx, opts.instance);
    const auth = btoa(`${cfg.email}:${cfg.apiKey}`);
    let url = `${cfg.url}/api/v1${opts.path}`;
    if (opts.query) url += `?${new URLSearchParams(opts.query)}`;
    const body = opts.form ? new URLSearchParams(opts.form).toString() : undefined;
    const res = await fetch(url, {
        method: opts.method ?? "GET",
        headers: { Authorization: `Basic ${auth}`, ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
        body,
    });
    const text = await res.text();
    let json: any;
    try { json = text ? JSON.parse(text) : null; }
    catch { throw new Error(`Zulip API ${res.status} ${opts.path}: non-JSON response: ${text.slice(0, 200)}`); }
    if (!res.ok || json?.result !== "success") throw new Error(`Zulip API ${res.status} ${opts.path}: ${json?.msg || JSON.stringify(json).slice(0, 200)}`);
    return json;
}
