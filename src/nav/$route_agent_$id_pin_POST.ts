/** POST /nav/agent/:id/pin — toggles the shared pin state from the web menu. */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Incoming HTMX form request. */ req: Request;
    /** Route parameters containing the agent id. */ params: Record<string, string>;
}) {
    const id = String(opts.params.id ?? "");
    const exists = ((await ctx.fns.procs.db.select({ sql: "SELECT 1 FROM agents WHERE id = ?", params: [id] })) as any[])[0];
    if (!exists) return new Response("agent not found", { status: 404 });

    const form = await opts.req.formData();
    const pinned = String(form.get("pinned") ?? "1") !== "0";
    const key = `mobile-pin-agent:${id}`;
    if (pinned) {
        await ctx.fns.procs.db.run({
            sql: "INSERT INTO kv(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",
            params: [key, String(Date.now())],
        });
    } else {
        await ctx.fns.procs.db.run({ sql: "DELETE FROM kv WHERE key = ?", params: [key] });
    }

    return new Response(null, { status: 204, headers: { "HX-Trigger": "nav-refresh" } });
}
