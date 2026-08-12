export default async function <T>(
    ctx: Context,
    _session: Session | null,
    opts: {
        id: string;
        mutate: (scratchpad: Record<string, any>, now: number) => T | Promise<T>;
        retries?: number;
    },
): Promise<{ scratchpad: Record<string, any>; result: T; ts: number }> {
    const retries = Math.max(1, Math.min(20, Number(opts.retries ?? 8)));
    for (let attempt = 0; attempt < retries; attempt++) {
        const rows = await ctx.fns.procs.db.select({ sql: "SELECT scratchpad FROM agents WHERE id = ?", params: [opts.id] }) as any[];
        if (!rows[0]) throw new Error(`mutateScratchpad: agent "${opts.id}" not found`);
        const previous = String(rows[0].scratchpad || "{}");
        const scratchpad = JSON.parse(previous);
        const ts = Date.now();
        const result = await opts.mutate(scratchpad, ts);
        const next = JSON.stringify(scratchpad ?? {}).replaceAll("\u0000", "\uFFFD");
        const update = await ctx.fns.procs.db.run({
            sql: "UPDATE agents SET scratchpad = ?, updated_at = ? WHERE id = ? AND scratchpad = ?",
            params: [next, ts, opts.id, previous],
        });
        if (update.changes > 0) return { scratchpad, result, ts };
    }
    throw new Error(`mutateScratchpad: concurrent updates for agent "${opts.id}" did not settle`);
}
