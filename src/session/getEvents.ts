export default function (ctx: Context, id: string): any[] {
    const rows = ctx.fns.db.select<any>(ctx, 'SELECT payload FROM events WHERE agent_id = ? ORDER BY idx', [id]);
    return rows.map((r: any) => JSON.parse(r.payload));
}
