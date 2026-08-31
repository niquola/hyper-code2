/**
 * Public credential metadata: list configured Zulip instance names, never values.
 * The encrypted local registry is authoritative after a first 1Password bootstrap.
 */
async function bootstrapInstances(ctx: Context): Promise<string[]> {
    const vault = ctx.env.ZULIP_OP_VAULT || "hyper";
    const prefix = ctx.env.ZULIP_OP_ITEM_PREFIX || "zulip ";
    const paths = [ctx.env.PATH, `${ctx.env.HOME}/.local/bin`, "/opt/homebrew/bin", "/usr/local/bin"].filter(Boolean).join(":");
    const proc = Bun.spawn(["op", "item", "list", "--vault", vault, "--format=json"], {
        env: { ...process.env, ...ctx.env, PATH: paths }, stdout: "pipe", stderr: "pipe",
    });
    const timer = setTimeout(() => { try { proc.kill(9); } catch {} }, 15_000);
    const [stdout, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]).finally(() => clearTimeout(timer));
    if (code !== 0) throw new Error("Zulip instance registry is unavailable; unlock 1Password once to bootstrap it");
    const items = JSON.parse(stdout);
    return items.map((item: any) => String(item.title ?? ""))
        .filter((title: string) => title.startsWith(prefix))
        .map((title: string) => title.slice(prefix.length).replace(/\.json$/, ""))
        .filter(Boolean).sort();
}

/**
 * Lists configured Zulip instance names through the encrypted local registry.
 *
 * @param opts.refresh Re-read 1Password metadata and replace the local registry.
 */
export default async function (ctx: Context, _session: Session | null, opts?: {
    /** Refresh instance metadata from the 1Password bootstrap provider. @default false */
    refresh?: boolean;
}): Promise<string[]> {
    const state = ((ctx.state as any).zulip ??= { creds: {}, instances: null });
    if (!opts?.refresh && state.instances) return state.instances as string[];
    if (!opts?.refresh) {
        const raw = await ctx.fns.secrets.getLocal({ namespace: "zulip", name: "instances" });
        if (raw) {
            const local = JSON.parse(raw);
            if (Array.isArray(local)) return state.instances = local.filter((x: any): x is string => typeof x === "string");
        }
    }
    const instances = await bootstrapInstances(ctx);
    await ctx.fns.secrets.putLocal({ namespace: "zulip", name: "instances", value: JSON.stringify(instances), source: "op-bootstrap" });
    state.instances = instances;
    return instances;
}
