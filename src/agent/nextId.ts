export default function (ctx: Context): string {
    const letters = 'abcdefghijklmnopqrstuvwxyz';

    const row = ctx.fns.db.select<any>(ctx, 'SELECT value FROM kv WHERE key = ?', ['agent:idCounter'])[0];
    const current = Number(row?.value ?? 0);
    const next = current + 1;

    ctx.fns.db.exec(ctx,
        'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        ['agent:idCounter', String(next)],
    );

    let n = next;
    let out = '';
    while (n > 0) {
        n -= 1;
        out = letters[n % 26] + out;
        n = Math.floor(n / 26);
    }
    return out;
}
