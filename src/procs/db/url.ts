// The database location — resolved through the config system (defaults <
// package.json procs.prod."procs/db" < env DATABASE_URL). A Postgres URL,
// passed through verbatim (no path resolution — the db is a server now).
export default function (ctx: Context, _session: Session | null, _opts?: {}): string {
    return (ctx.fns.procs.config.resolve({ module: "procs/db" }) as ConfigOf<typeof import("./$config").default>).url;
}
