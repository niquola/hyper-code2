import { Database } from "bun:sqlite";

export default function (ctx: Context, path: string): Database {
    const db = new Database(path, { create: true });
    db.exec("PRAGMA journal_mode = WAL");
    (ctx.state as any).db = db;
    return db;
}
