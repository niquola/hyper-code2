// GET /ui/rail?current=<id> — the agents rail's content, as a fragment. The
// placeholder in layout.ts pulls it on load and every 20s; see agentsRail.ts.
export default async function (ctx: Context, _session: Session | null, opts: { req: Request }) {
    const url = new URL(opts.req.url);
    const currentId = url.searchParams.get("current") ?? undefined;
    const archived = url.searchParams.get("archived") === "1";
    return new Response(await ctx.fns.ui.agentsRail({ currentId, archived }), { headers: { "content-type": "text/html; charset=utf-8" } });
}
