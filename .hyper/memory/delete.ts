export default async function (ctx: Context, key: string) {
  const db = ctx.state.memoryDb;
  if (!db) throw new Error('memory DB not initialized');
  const info = db.prepare('DELETE FROM memory WHERE key = ?').run(key);
  return { deleted: true, key, changes: info.changes };
}