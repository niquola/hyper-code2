/** Returns the prompt-inject line for one native chat. */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const row = ((await ctx.fns.procs.db.select({ sql: "SELECT status_line, status_line_every FROM agents WHERE id = ?", params: [opts.params.id!] })) as any[])[0];
    if (!row) return Response.json({ error: "not_found", message: "Agent not found" }, { status: 404 });
    return Response.json({ version: 1, text: row.status_line || "", every: Number(row.status_line_every ?? 1) });
}
