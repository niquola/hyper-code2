// POST /agent/:id/unarchive — back to the rail. Answers 200 with no body: the
// rail button that calls this refreshes the rail itself on success.
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const id = opts.params.id!;
    const { ok } = await ctx.fns.session.unarchive({ id });
    return new Response(ok ? "ok" : "not found", { status: ok ? 200 : 404 });
}
