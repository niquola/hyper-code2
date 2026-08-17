/** Changes one agent's durable reasoning effort from the chat header. */
/**
 * Validate the submitted effort and update only the selected agent.
 * @param opts.req Incoming form request containing effort.
 * @param opts.params Route parameters containing the agent id.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Incoming form request. */ req: Request;
    /** Route parameters containing id. */ params: Record<string, string>;
}) {
    const form = await opts.req.formData();
    const effort = String(form.get("effort") ?? "auto") as types.llm.ReasoningEffort;
    try {
        const result = await ctx.fns.agent.setReasoningEffort({ id: opts.params.id!, effort });
        return new Response(null, { status: 204, headers: { "HX-Refresh": "true", "x-hyper-effort": result.applied } });
    } catch (error: any) {
        return new Response(error?.message ?? "Invalid effort", { status: 400 });
    }
}
