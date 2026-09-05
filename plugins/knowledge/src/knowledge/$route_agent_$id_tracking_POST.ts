/** POST /knowledge/agent/:id/tracking — toggles entity extraction sidecars for one agent. */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Incoming form request. */ req: Request;
    /** Route path parameters. */ params: Record<string, string>;
}) {
    const form = await opts.req.formData();
    try {
        await ctx.fns.knowledge.setTracking({ id: opts.params.id!, enabled: form.get("enabled") === "1" });
    } catch (error: any) {
        return new Response(error?.message ?? "Invalid knowledge tracking setting", { status: 400 });
    }
    return new Response(null, { status: 204 });
}
