/**
 * Remove unreferenced attachment metadata and blobs
 *
 * Garbage-collects metadata no longer referenced by a transcript, then removes
 * content-addressed blobs with no metadata owner. Also cleans crash-orphaned
 * blob files older than one hour.
 */
export default async function (ctx: Context, _session: Session | null, _opts: {}): Promise<{ rows: number; blobs: number }> {
    const { readdir, stat, unlink } = await import("node:fs/promises");
    const { resolve } = await import("node:path");
    const rows = await ctx.fns.procs.db.select({ sql: "SELECT id,storage_path FROM attachments", params: [] }) as any[];
    let removed = 0;
    for (const row of rows) {
        const hit = await ctx.fns.procs.db.select({ sql: "SELECT 1 FROM messages WHERE content LIKE ? LIMIT 1", params: [`%\"attachmentId\":\"${row.id}\"%`] }) as any[];
        if (hit.length) continue;
        await ctx.fns.procs.db.run({ sql: "DELETE FROM attachments WHERE id=?", params: [row.id] });
        removed++;
    }
    const left = await ctx.fns.procs.db.select({ sql: "SELECT DISTINCT storage_path FROM attachments", params: [] }) as any[];
    const keep = new Set(left.map((row: any) => String(row.storage_path)));
    const candidates = new Set(rows.map((row: any) => String(row.storage_path)));
    const dir = resolve(String((ctx.state as any).root ?? process.cwd()), ".runtime", "uploads", "blobs");
    for (const name of await readdir(dir).catch(() => [])) candidates.add(resolve(dir, name));
    let blobs = 0;
    for (const path of candidates) {
        if (keep.has(path)) continue;
        const info = await stat(path).catch(() => null);
        if (!info || Date.now() - info.mtimeMs < 60 * 60_000) continue;
        try { await unlink(path); blobs++; } catch {}
    }
    return { rows: removed, blobs };
}
