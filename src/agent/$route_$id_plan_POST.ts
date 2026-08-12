export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const id = opts.params.id!;
    const agent = (ctx.state as any).agent?.[id] ?? await ctx.fns.session.load({ id });
    if (!agent) return new Response("not found", { status: 404 });
    try {
        const form = await opts.req.formData();
        const action = String(form.get("action") ?? "archive");
        if (action === "update") {
            const payload = JSON.parse(String(form.get("plan") ?? "{}"));
            await ctx.fns.session.updatePlan({ agent, title: payload.title, tasks: payload.tasks });
        } else {
            await ctx.fns.session.removePlan({ agent, archive: action !== "delete" });
        }
        return new Response(null, { status: 204 });
    } catch (error: any) {
        return new Response(error?.message ?? "Invalid plan", { status: 400 });
    }
}
