export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const form = await opts.req.formData();
    try {
        await ctx.fns.agent.setGoal({
            id: opts.params.id!,
            statement: String(form.get('statement') ?? ''),
            iterations: Number(form.get('iterations') ?? 3),
            enabled: form.get('enabled') === '1',
        });
    } catch (error: any) {
        return new Response(error?.message ?? 'Invalid goal', { status: 400 });
    }
    return new Response(null, { status: 204, headers: { 'HX-Refresh': 'true' } });
}
