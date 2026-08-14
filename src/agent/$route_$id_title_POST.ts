/** Handles the id title post HTTP route.  * @param opts.req Incoming HTTP request.
 * @param opts.params Route path parameters.
*/
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Incoming HTTP request. */
    req: Request;
        /** Values bound to the operation. */
    params: Record<string, string> },
) {
    const id = opts.params.id!;
    const form = await opts.req.formData();
    const title = String(form.get("title") ?? "");
    try {
        await ctx.fns.session.setTitle({ id, title });
    } catch {
        return new Response("Not Found", { status: 404 });
    }

    if (opts.req.headers.get("hx-request") === "true") {
        return new Response(null, {
            status: 204,
            headers: { "HX-Refresh": "true" },
        });
    }
    return new Response(null, {
        status: 303,
        headers: { location: `/agent/${encodeURIComponent(id)}` },
    });
}