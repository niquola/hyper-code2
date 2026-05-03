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

export default function (ctx: Context): string {
    const row = ctx.fns.db.select<any>(ctx, { sql: 'SELECT value FROM kv WHERE key = ?', params: ['agent:idCounter'] })[0];
    const next = Number(row?.value ?? 0) + 1;
    ctx.fns.db.exec(ctx, {
        sql: 'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        params: ['agent:idCounter', String(next)],
    });
    return encode(next);
}
