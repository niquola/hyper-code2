/** Lists loaded functions, optionally restricted to one namespace. */
export default function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Dotted namespace prefix, for example `agent` or `procs.db`. */
        namespace?: string;
    } = {},
): Array<{ name: string; summary: string; signature: string }> {
    const prefix = String(opts.namespace ?? "").replace(/\.$/, "");
    const out: any[] = [];
    const walk = (node: any) => {
        for (const value of Object.values(node ?? {})) {
            if (typeof value === "function" && (value as any).meta) {
                const meta = (value as any).meta;
                if (!prefix || meta.name === prefix || meta.name.startsWith(prefix + ".")) {
                    out.push({ name: meta.name, summary: meta.summary, signature: meta.signature });
                }
            } else if (value && typeof value === "object") walk(value);
        }
    };
    walk(ctx.state.registry);
    return out.sort((a, b) => a.name.localeCompare(b.name));
}
