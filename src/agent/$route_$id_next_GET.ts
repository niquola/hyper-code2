// GET /agent/:id/next?dir=-1 — the agent before or after this one.
//
// Who comes next is a property of the LIST, and the list is the server's: the
// same order the rail renders. The hotkeys used to rebuild it in the browser —
// scraping links out of the rail, filtering invisible ones, wrapping around —
// which is a second implementation of an ordering that already exists, and it
// disagreed with the rail the moment either changed.
//
// So the browser asks "who is next after me" and renders the answer. It keeps
// no list, no index and no idea what order means.
/** Handles the id next get HTTP route.  * @param opts.req Incoming HTTP request.
 * @param opts.params Route path parameters.
*/
export default async function (ctx: Context, session: Session | null, opts: {
        /** Incoming HTTP request. */
req: Request;
        /** Values bound to the operation. */
params: Record<string, string> }) {
    const from = opts.params.id!;
    const dir = new URL(opts.req.url).searchParams.get("dir") === "-1" ? -1 : 1;

    const agents = await ctx.fns.session.list({}).catch(() => [] as any[]);
    if (!agents.length) return new Response("no agents", { status: 404 });

    const at = agents.findIndex((a: any) => a.id === from);
    // Unknown agent: start at the end the direction comes from.
    const next = at < 0
        ? (dir > 0 ? agents[0] : agents[agents.length - 1])
        : agents[(at + dir + agents.length) % agents.length];

    // Render the neighbour's page through the ordinary path — one request, the
    // same content a click on the rail would produce, and the address bar
    // follows via HX-Push-Url so Back works as usual.
    const res = await ctx.fns.procs.http.dispatch({
        url: `/agent/${next.id}`,
        headers: { "hx-request": "true" },
    });
    const out = new Response(res.body, res);
    out.headers.set("HX-Push-Url", `/agent/${next.id}`);
    return out;
}
