// Parse argv → { command, opts }. First positional is the command; the rest
// become { _: [positionals], flag: value }. `--k v` / `--k=v` / `--flag` (bool)
// / `-x`. Numeric-looking values stay strings (config-style coercion is the
// command's job).
/**
 * Parse the cli subsystem operation.
 * @param opts.argv The argv value used by the operation.
 */
export default function (_ctx: Context, _session: Session | null, opts: { argv: string[] }) {
    const argv = opts.argv;
    const command = argv[0] && !argv[0].startsWith("-") ? argv[0] : undefined;
    const rest = command ? argv.slice(1) : argv;
    const out: Record<string, any> = { _: [] as string[] };
    for (let i = 0; i < rest.length; i++) {
        const a = rest[i]!;
        if (a.startsWith("--")) {
            const eq = a.indexOf("=");
            // Next token is the value unless it's another flag — but a negative
            // number (`--offset -5`) is a value, not a flag.
            const nv = rest[i + 1];
            const isValue = nv !== undefined && (!nv.startsWith("-") || /^-\d/.test(nv));
            if (eq !== -1) out[a.slice(2, eq)] = a.slice(eq + 1);
            else if (isValue) out[a.slice(2)] = rest[++i];
            else out[a.slice(2)] = true;
        } else if (a.startsWith("-")) {
            out[a.slice(1)] = true;
        } else {
            out._.push(a);
        }
    }
    return { command, opts: out };
}
