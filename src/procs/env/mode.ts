// The current environment, derived per-ctx from ctx.env.NODE_ENV:
//   "production" → "prod" ; "test" → "test" ; anything else → "dev".
// Per-ctx (not per-process), so a forked test env coexists with dev.
export type Mode = "prod" | "test" | "dev";

export default function (ctx: Context, _session: Session | null, _opts?: {}): Mode {
    const n = ctx.env.NODE_ENV;
    return n === "production" ? "prod" : n === "test" ? "test" : "dev";
}
