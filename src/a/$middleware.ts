// `/a/<agentId>/<page>` — the agent lives in the PATH.
//
// The chat is docked on every page, so the frame has to know whose chat to
// show. That used to be a variable on the server (ctx.state.uiCurrentAgent):
// one value for the whole process, so two tabs on two agents overwrote each
// other and you could end up reading one agent while writing to another.
//
// A tab is a pair — an agent and a page — so the URL says both. Nothing is
// remembered anywhere: the link is the state, it survives a reload, it can be
// bookmarked and shared, and two tabs cannot interfere.
//
// The page itself is not duplicated: this strips the prefix and re-dispatches
// to the ordinary route, passing the agent along in a header for the layout.
//   /a/eh          → /agent/eh
//   /a/eh/files    → /files      (rendered with eh's chat beside it)
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { req: Request },
): Promise<Response | undefined> {
    const url = new URL(opts.req.url);
    const m = /^\/a\/([A-Za-z0-9_-]+)(\/.*)?$/.exec(url.pathname);
    if (!m) return;

    const agentId = m[1]!;
    const rest = m[2];
    const inner = !rest || rest === "/" ? `/agent/${agentId}${url.search}` : rest + url.search;

    const headers: Record<string, string> = {};
    opts.req.headers.forEach((value, key) => { headers[key] = value; });
    headers["x-hyper-agent"] = agentId;

    const method = opts.req.method.toUpperCase();
    const body = method === "GET" || method === "HEAD" ? undefined : await opts.req.text();

    return await ctx.fns.procs.http.dispatch({ method, url: inner, headers, body });
}
