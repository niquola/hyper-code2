export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const id = opts.params.id!;
    const list = await ctx.fns.session.list({});
    const idx = list.findIndex((a: any) => a.id === id);
    await ctx.fns.session.delete({ id });
    delete (ctx.state as any).agent?.[id];
    const remaining = await ctx.fns.session.list({});
    const next = remaining[idx] ?? remaining[idx - 1] ?? remaining[0] ?? null;
    return new Response(null, { status: 303, headers: { location: next ? `/agent/${encodeURIComponent(next.id)}` : `/` } });
}
