export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const form = await opts.req.formData();
    try {
        await ctx.fns.agent.setAutomation({
            id: opts.params.id!,
            reflectionEnabled: form.get('reflectionEnabled') === '1',
            sleepEnabled: form.get('sleepEnabled') === '1',
        });
    } catch (error: any) {
        return new Response(error?.message ?? 'Invalid automation settings', { status: 400 });
    }
    return new Response(null, { status: 204 });
}
