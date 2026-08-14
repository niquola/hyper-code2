/** Set status line for the runtime.  * @param opts.id Target agent identifier.
 * @param opts.text Plain-text transcript fallback.
 * @param opts.every Optional cadence override.
*/
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Agent identifier. */
    id: string;
        /** Text used by the operation. */
    text: string;
        /** Every used by the operation. */
    every?: number },
): Promise<{ text: string; every: number }> {
    const text = String(opts.text ?? "").trim().slice(0, 500);
    const every = Math.max(1, Math.min(100, Math.floor(Number(opts.every ?? 1) || 1)));
    const result = await ctx.fns.procs.db.run({
        sql: "UPDATE agents SET status_line = ?, status_line_every = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL",
        params: [text, every, Date.now(), opts.id],
    });
    if (result.changes === 0) throw new Error(`agent not found: ${opts.id}`);
    const agent = (ctx.state as any).agent?.[opts.id];
    if (agent) { agent.statusLine = text; agent.statusLineEvery = every; }
    return { text, every };
}
