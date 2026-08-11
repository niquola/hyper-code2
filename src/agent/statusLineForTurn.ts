export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { agent: types.agent.Agent },
): Promise<string> {
    const agent = opts.agent;
    const text = String(agent.statusLine ?? "").trim();
    if (!text) return "";
    const every = Math.max(1, Number(agent.statusLineEvery ?? 1));
    const row = ((await ctx.fns.procs.db.select({
        sql: "SELECT COUNT(*) AS n FROM messages WHERE agent_id = ? AND role = 'user' AND excluded_from_cursor = 0",
        params: [agent.id],
    })) as any[])[0];
    const turn = Number(row?.n ?? 0);
    return turn > 0 && turn % every === 0 ? text : "";
}
