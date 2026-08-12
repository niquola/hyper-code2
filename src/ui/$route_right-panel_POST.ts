// POST /ui/right-panel — persist the workspace pane collapsed state server-side.
export default async function (ctx: Context, _session: Session | null, opts: { req: Request }) {
    let collapsed: boolean | null = null;
    const contentType = opts.req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
        const body = await opts.req.json().catch(() => ({})) as { collapsed?: unknown };
        if (typeof body.collapsed === "boolean") collapsed = body.collapsed;
    } else {
        const form = await opts.req.formData().catch(() => null);
        const value = form?.get("collapsed");
        if (value != null) collapsed = value === "1" || value === "true";
    }
    if (collapsed == null) {
        const row = ((await ctx.fns.procs.db.select({ sql: "SELECT value FROM kv WHERE key = ?", params: ["ui:rightPanelCollapsed"] })) as any[])[0];
        collapsed = row?.value !== "1";
    }
    await ctx.fns.procs.db.run({
        sql: `INSERT INTO kv (key, value) VALUES (?, ?)
              ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
        params: ["ui:rightPanelCollapsed", collapsed ? "1" : "0"],
    });
    return Response.json({ ok: true, collapsed });
}
