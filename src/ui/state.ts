// Server-side view of the UI. Durable preferences come from Postgres; where the
// person is comes from the traffic they generate (src/$middleware.ts records it
// on every page GET), because a browser cannot look at a page without asking us
// for it. Two beacons used to report the same fact on a channel of their own.
export default async function (ctx: Context, _session: Session | null, opts?: { staleAfterMs?: number }) {
    const rows = await ctx.fns.procs.db.select({
        sql: "SELECT key, value FROM kv WHERE key IN (?, ?)",
        params: ["ui:rightPanelCollapsed", "ui:chatWidth"],
    }).catch(() => []) as any[];
    const kv = Object.fromEntries(rows.map((row: any) => [row.key, row.value]));
    const here = ctx.fns.screen.where({ staleAfterMs: opts?.staleAfterMs });
    const live = (ctx.state.screen as any)?.ui ?? null;
    return {
        agentId: live?.agentId ?? here?.agentId ?? null,
        url: live?.url ?? here?.url ?? null,
        page: live?.page ?? here?.page ?? null,
        title: live?.title ?? here?.title ?? null,
        workspaceCollapsed: kv["ui:rightPanelCollapsed"] === "1",
        chatWidth: kv["ui:chatWidth"] || null,
        viewport: live?.viewport ?? null,
        at: live?.at ?? here?.at ?? null,
        stale: live?.at ? Date.now() - Date.parse(live.at) > (opts?.staleAfterMs ?? 10 * 60_000) : (here?.stale ?? true),
    };
}
