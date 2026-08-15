/** Retries one blocked or failed direct team member from the parent Meta panel. */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Route parameters containing parent and member IDs. */
    params: Record<string, string>;
}): Promise<Response> {
    const agent = await ctx.fns.session.load({ id: String(opts.params.id ?? "") });
    if (!agent) return new Response("parent not found", { status: 404 });
    await ctx.fns.agent.retryMember({ agent, member: String(opts.params.member ?? "") });
    return new Response(null, { status: 204 });
}
