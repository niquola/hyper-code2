// Sequential base-26 IDs: a, b, …, z, aa, ab, ….
// Counter is persisted in the kv table (added by migration 20270501123000_add_kv).
// Tests that call start() must connect a DB and run migrations (use mkTestCtx).
const letters = 'abcdefghijklmnopqrstuvwxyz';

function encode(n: number): string {
    let out = '';
    while (n > 0) {
        n -= 1;
        out = letters[n % 26] + out;
        n = Math.floor(n / 26);
    }
    return out;
}

/** Next id for the runtime. */
export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<string> {
    // One atomic statement: two concurrent starts (e.g. the goal and knowledge
    // sidecars forked from the same POST) must never observe the same counter
    // value — a separate SELECT then UPDATE handed both the same id and let one
    // fork's save overwrite the other's row.
    const rows = await ctx.fns.procs.db.select({
        sql: `INSERT INTO kv (key, value) VALUES (?, '1')
              ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(kv.value AS INTEGER) + 1 AS TEXT)
              RETURNING value`,
        params: ['agent:idCounter'],
    }) as any[];
    return encode(Number(rows[0]?.value ?? 1));
}
