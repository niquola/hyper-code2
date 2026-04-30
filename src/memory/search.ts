export default async function (
  ctx: Context,
  query?: string,     // key prefix or partial match
  opts?: { tag?: string; limit?: number }
) {
  const db = ctx.state.memoryDb;
  if (!db) throw new Error('memory DB not initialized');

  let sql = 'SELECT * FROM memory';
  const params: any[] = [];
  const conditions: string[] = [];

  if (query) {
    conditions.push('key LIKE ?');
    params.push(query + '%');
  }
  if (opts?.tag) {
    conditions.push('tags LIKE ?');
    params.push('%"' + opts.tag + '"%');
  }

  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(opts?.limit ?? 50);

  const rows: any[] = db.query(sql).all(...params);
  return rows.map(r => ({ id: r.id, key: r.key, value: JSON.parse(r.value), tags: JSON.parse(r.tags ?? '[]'), createdAt: r.created_at }));
}