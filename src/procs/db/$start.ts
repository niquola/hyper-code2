// db module init — open the pool eagerly at boot (instead of lazily on first
// query) and ping it, so a dead Postgres fails the lifecycle loudly. The handle
// lives in ctx.state.procs.db.sql (set by db.conn). Listed in package.json
// procs.prod before "http" so the db is ready when traffic starts.
//
// hyper-code2: wait for Postgres instead of dying on the first refused
// connection. At login the runtime starts before Docker has finished bringing
// the database up, so a single ping meant the process exited, launchd restarted
// it ten seconds later, and that repeated until the container was ready —
// recovery by crash loop, with a log full of failures that were not failures.
//
// Waiting is bounded: if the database is genuinely gone, the process still dies
// loudly rather than serving requests it cannot answer.
const WAIT_MS = Number(process.env.DB_WAIT_MS ?? 120_000);
const RETRY_MS = 2_000;

export default async function (ctx: Context, _session: Session | null, _config?: any) {
    const deadline = Date.now() + Math.max(0, WAIT_MS);
    let announced = false;
    for (;;) {
        try {
            await ctx.fns.procs.db.select({ sql: "SELECT 1" });
            if (announced) ctx.fns.procs.log.info({ event: "db.ready", msg: "database accepted a connection" });
            return;
        } catch (error: any) {
            if (Date.now() >= deadline) throw error;
            if (!announced) {
                announced = true;
                ctx.fns.procs.log.warn({
                    event: "db.waiting",
                    msg: `database unreachable (${error?.message ?? error}) — waiting up to ${Math.round(WAIT_MS / 1000)}s`,
                });
            }
            await Bun.sleep(RETRY_MS);
        }
    }
}
