/** POST /cron/defer — creates a relative one-shot task from the management form. */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request }) {
    const form = await opts.req.formData();
    try {
        const raw = String(form.get("args") ?? "{}").trim() || "{}";
        const args = JSON.parse(raw);
        if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("arguments must be a JSON object");
        const job = await ctx.fns.cron.defer({ name: String(form.get("name") ?? "") || undefined, fn: String(form.get("fn") ?? ""), in: String(form.get("in") ?? ""), args });
        return new Response(await ctx.fns.cron.panel({ message: `Scheduled ${job.name}` }), { headers: { "content-type": "text/html; charset=utf-8" } });
    } catch (error: any) {
        return new Response(await ctx.fns.cron.panel({ error: String(error?.message ?? error) }), { status: 400, headers: { "content-type": "text/html; charset=utf-8" } });
    }
}
