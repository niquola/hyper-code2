// Log module init — resolve config and initialize ctx.state.procs.log.
// Listed first in package.json proc.prod so all other $start hooks can log.
const LEVELS: Record<string, number> = { off: -1, error: 0, warn: 1, info: 2, debug: 3 };

export default function (ctx: Context, _session: Session | null, _config?: any) {
    const config = ctx.fns.procs.config.resolve({ module: "procs/log" });
    ctx.state.procs.log = {
        level: LEVELS[config.level] ?? 2,
        format: (config.format ?? "pretty") as "pretty" | "json",
        service: config.service ?? "procs",
    };
}
