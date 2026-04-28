// Called once at startup — creates the table if not exists.
export default async function (ctx: Context) {
  const db = await import('bun:sqlite');
  ctx.state.memoryDb ??= new db.Database(':memory:');

  ctx.state.memoryDb.exec(`
    CREATE TABLE IF NOT EXISTS memory (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      key        TEXT UNIQUE NOT NULL,
      value      TEXT NOT NULL,
      tags       TEXT DEFAULT '[]',
      created_at INTEGER DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_memory_key ON memory(key);
  `);

  return { ok: true, table: 'memory' };
}