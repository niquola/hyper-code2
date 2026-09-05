/** Returns the next unread visible agent after the current agent, wrapping once. */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }): Promise<Response> {
    const current = new URL(opts.req.url).searchParams.get("current")?.trim() ?? "";
    const agents = (await ctx.fns.session.list({})).filter((item: any) => Number(item.unread ?? 0) > 0);
    if (!agents.length) return Response.json({ id: null });
    // session.list is newest-first. Continue after current when it is unread;
    // otherwise start at the newest unread agent.
    const index = agents.findIndex((item: any) => item.id === current);
    const next = index >= 0 ? agents[(index + 1) % agents.length] : agents[0];
    return Response.json({ id: next?.id ?? null });
}
