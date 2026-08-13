export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const form = await opts.req.formData();
    const status = String(form.get('status') ?? '');
    if (!['todo', 'running', 'done'].includes(status)) return Response.json({ error: 'invalid status' }, { status: 400 });
    const task = await ctx.fns.tasks.setStatus({ id: opts.params.id!, status: status as any });
    return new Response(null, { status: 303, headers: { location: `/tasks/${encodeURIComponent(task.id)}` } });
}
