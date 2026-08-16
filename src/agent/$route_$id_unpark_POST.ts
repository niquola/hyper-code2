/** Handles the agent :id unpark POST HTTP route — ending a usage-limit parking.
 * @param opts.req Incoming HTTP request.
 * @param opts.params Route path parameters.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Incoming HTTP request. */
    req: Request;
    /** Route path parameters. */
    params: Record<string, string>;
}) {
    const form = await opts.req.formData();
    // "now" retries immediately (and re-parks if the quota is still spent);
    // "cancel" just drops the wait and leaves the agent idle.
    const resume = String(form.get("action") ?? "now") !== "cancel";
    try {
        const result = await ctx.fns.agent.unpark({ id: opts.params.id!, reason: "manual", resume });
        return new Response(null, { status: 204, headers: { "x-hyper-was-parked": String(result.wasParked) } });
    } catch (error: any) {
        return new Response(error?.message ?? "Cannot unpark", { status: 400 });
    }
}
