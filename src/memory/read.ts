export default async function (
  ctx: Context,
  key: string,
) {
  const db = ctx.state.memoryDb;
  if (!db) throw new Error('memory DB not initialized');

  const row: any = db.query('SELECT * FROM memory WHERE key = ?').get(key);
  if (!row) return null;
  return { id: row.id, key: row.key, value: JSON.parse(row.value), tags: JSON.parse(row.tags ?? '[]'), createdAt: row.created_at };
}