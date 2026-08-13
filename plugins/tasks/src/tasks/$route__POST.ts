export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const form = await opts.req.formData();
    const description = String(form.get('description') ?? '').trim();
    const workspaceMode = form.get('workspaceMode') === 'isolated' ? 'isolated' : 'default';
    if (!description) return Response.json({ error: 'description is required' }, { status: 400 });
    const task = await ctx.fns.tasks.create({ description, workspaceMode });
    return new Response(null, { status: 303, headers: { location: `/tasks/${encodeURIComponent(task.id)}` } });
}
