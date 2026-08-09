// bun test preload (bunfig.toml [test].preload). Test ctxs open one-connection
// Postgres pools pinned to pg_temp (see procs/db/conn.ts); each file's afterAll
// closes them so idle pooled connections don't pile up toward max_connections
// across the suite. `.entry.ts` keeps this out of the fn scanner.
import { afterAll } from "bun:test";

afterAll(async () => {
    const pools: Set<any> | undefined = (globalThis as any).__hyperTestPools;
    if (!pools) return;
    for (const sql of [...pools]) {
        pools.delete(sql);
        try { await sql.close(); } catch { /* already closed */ }
    }
});
