import { Glob } from "bun";
import { resolve, basename } from "node:path";

export default async function (ctx: Context): Promise<{ applied: string[] }> {
    const db = (ctx.state as any).db;
    if (!db) throw new Error("db not connected — call ctx.fns.db.connect first");

    db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at INTEGER NOT NULL
    )`);
    const already = new Set(
        (db.query("SELECT name FROM _migrations").all() as any[]).map((r) => r.name),
    );

    const srcDir = resolve(import.meta.dir, "..");
    const hyperDir = resolve(srcDir, "..", ".hyper");

    const found: Array<{ name: string; path: string }> = [];
    for (const root of [srcDir, hyperDir]) {
        const exists = await Bun.file(root).stat().then(() => true).catch(() => false);
        if (!exists) continue;
        const glob = new Glob("**/$migrate_*.up.sql");
        for await (const file of glob.scan(root)) {
            const name = basename(file, ".up.sql").slice("$migrate_".length);
            if (!name) continue;
            found.push({ name, path: resolve(root, file) });
        }
    }
    found.sort((a, b) => (a.name < b.name ? -1 : 1));

    const applied: string[] = [];
    const insert = db.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)");
    for (const m of found) {
        if (already.has(m.name)) continue;
        const sql = await Bun.file(m.path).text();
        db.transaction(() => {
            db.exec(sql);
            insert.run(m.name, Date.now());
        })();
        applied.push(m.name);
        console.log(`[migrate] applied ${m.name}`);
    }
    return { applied };
}
