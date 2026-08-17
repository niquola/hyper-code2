/** POST /cron/add — creates a recurring interval task from the management form. */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request }) {
    const form = await opts.req.formData();
    try {
        const raw = String(form.get("args") ?? "{}").trim() || "{}";
        const args = JSON.parse(raw);
        if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("arguments must be a JSON object");
        const job = await ctx.fns.cron.add({ name: String(form.get("name") ?? ""), fn: String(form.get("fn") ?? ""), every: String(form.get("every") ?? ""), args, now: form.get("now") === "1" });
        return new Response(await ctx.fns.cron.panel({ message: `Scheduled ${job.name}` }), { headers: { "content-type": "text/html; charset=utf-8" } });
    } catch (error: any) {
        return new Response(await ctx.fns.cron.panel({ error: String(error?.message ?? error) }), { status: 400, headers: { "content-type": "text/html; charset=utf-8" } });
    }
}
