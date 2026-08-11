export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { agent: types.agent.Agent },
): Promise<string> {
    const agent = opts.agent;
    const userText = String(agent.statusLine ?? "").trim();
    const every = Math.max(1, Number(agent.statusLineEvery ?? 1));
    const row = ((await ctx.fns.procs.db.select({
        sql: "SELECT COUNT(*) AS n FROM messages WHERE agent_id = ? AND role = 'user' AND excluded_from_cursor = 0",
        params: [agent.id],
    })) as any[])[0];
    const parts: string[] = [];
    const turn = Number(row?.n ?? 0);
    if (userText && turn > 0 && turn % every === 0) parts.push(`User status line: ${userText}`);

    const nudge = agent.reflection?.state?.reflectionNudge;
    if (nudge?.text) {
        const createdAt = Number(nudge.createdAtUserCount ?? agent.reflection?.reflectedUserCount ?? 0);
        const ttl = Math.max(1, Number(nudge.expiresAfterTurns ?? 3));
        if (turn >= createdAt && turn <= createdAt + ttl) parts.push(`Reflection nudge: ${String(nudge.text).trim()}`);
    }
    return parts.join("\n");
}
