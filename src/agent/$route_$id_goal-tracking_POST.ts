/** Toggles display-only goal observation for one agent. */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Incoming form request. */ req: Request;
    /** Route path parameters. */ params: Record<string, string>;
}) {
    const form = await opts.req.formData();
    try {
        await ctx.fns.agent.setGoalTracking({
            id: opts.params.id!,
            enabled: form.get("enabled") === "1",
        });
    } catch (error: any) {
        return new Response(error?.message ?? "Invalid goal tracking setting", { status: 400 });
    }
    return new Response(null, { status: 204 });
}
