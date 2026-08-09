// db module init — open the pool eagerly at boot (instead of lazily on first
// query) and ping it, so a dead Postgres fails the lifecycle loudly. The handle
// lives in ctx.state.procs.db.sql (set by db.conn). Listed in package.json
// procs.prod before "http" so the db is ready when traffic starts.
export default async function (ctx: Context, _session: Session | null, _config?: any) {
    await ctx.fns.procs.db.select({ sql: "SELECT 1" });
}
