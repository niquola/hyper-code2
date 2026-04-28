export default async function (
  ctx: Context,
  key: string,
  value: any,
  opts?: { tags?: string[] }
) {
  const db = ctx.state.memoryDb;
  if (!db) throw new Error('memory DB not initialized');

  const existing = db.query('SELECT id FROM memory WHERE key = ?').get(key);
  if (existing) {
    db.prepare('UPDATE memory SET value = ?, tags = ? WHERE key = ?')
      .run(JSON.stringify(value), JSON.stringify(opts?.tags ?? []), key);
    return { updated: true, key };
  } else {
    const info = db.prepare(
      'INSERT INTO memory (key, value, tags) VALUES (?, ?, ?)'
    ).run(key, JSON.stringify(value), JSON.stringify(opts?.tags ?? []));
    return { inserted: true, key, id: info.lastInsertRowId };
  }
}