// Lazily open the sqlite connection and cache it in this module's own state —
// ctx.state.procs.db.connection, like every module's state. Because state
// is per-ctx, a forked test env (env.fork) gets its OWN isolated connection —
// dev's file db and a test's :memory: db never touch.
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export default function (ctx: Context, _session: Session | null, _opts?: {}): Database {
    const st = ((ctx.state.procs ??= {} as any).db ??= {});
    if (st.connection) return st.connection;
    const url = ctx.fns.procs.db.url();
    if (url !== ":memory:" && url.includes("/")) mkdirSync(dirname(url), { recursive: true });
    st.connection = new Database(url);
    // hyper-code2: file-backed DBs run WAL — concurrent agent runs write from
    // several promises and WAL keeps readers unblocked.
    if (url !== ":memory:") st.connection.exec("PRAGMA journal_mode = WAL");
    return st.connection;
}
