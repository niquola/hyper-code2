// Public credential metadata: list configured Zulip instance names, never values.
// Secrets are resolved privately inside zulip.api and are not returned by any fn.
async function op(args: string[]) {
    const paths = [process.env.PATH, `${process.env.HOME}/.local/bin`, "/opt/homebrew/bin", "/usr/local/bin"].filter(Boolean).join(":");
    const proc = Bun.spawn(["op", ...args], { env: { ...process.env, PATH: paths }, stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, code] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
    ]);
    if (code !== 0) throw new Error(`Zulip credentials: 1Password CLI failed (${code}): ${stderr.trim().slice(0, 240)}`);
    return stdout;
}

export default async function (ctx: Context, _session: Session | null, _opts?: { list?: boolean }) {
    const state = ((ctx.state as any).zulip ??= { creds: {}, instances: null });
    if (state.instances) return state.instances as string[];
    const vault = ctx.env.ZULIP_OP_VAULT || "hyper";
    const prefix = ctx.env.ZULIP_OP_ITEM_PREFIX || "zulip ";
    const items = JSON.parse(await op(["item", "list", "--vault", vault, "--format=json"]));
    state.instances = items
        .map((item: any) => String(item.title ?? ""))
        .filter((title: string) => title.startsWith(prefix))
        .map((title: string) => title.slice(prefix.length).replace(/\.json$/, ""))
        .filter(Boolean)
        .sort();
    return state.instances;
}
