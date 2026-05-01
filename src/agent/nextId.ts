// Sequential base-26 IDs: a, b, …, z, aa, ab, …. Counter stored in kv table when
// a DB is connected; otherwise falls back to a per-process in-memory counter
// (handy for unit tests that don't run migrations).
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
    let next: number;
    try {
        const row = ctx.fns.db.select<any>(ctx, 'SELECT value FROM kv WHERE key = ?', ['agent:idCounter'])[0];
        const current = Number(row?.value ?? 0);
        next = current + 1;
        ctx.fns.db.exec(ctx,
            'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
            ['agent:idCounter', String(next)],
        );
    } catch {
        // No db / no kv table — per-process in-memory counter.
        const slot: { n: number } = ((ctx.state as any).__nextIdMem ??= { n: 0 });
        slot.n += 1;
        next = slot.n;
    }
    return encode(next);
}
