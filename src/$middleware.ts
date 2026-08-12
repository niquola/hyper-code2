// Where the person is — read off the traffic they already generate.
//
// Two beacons used to report this: the tab POSTed /screen/here after every
// render and /ui/state alongside it. But a browser cannot look at a page
// without asking this server for it, so the answer was already in every
// request — the beacons were a second channel carrying a fact we had.
//
// One line here replaces them, and it cannot go stale differently from what
// was served, because it IS what was served.
export default function (ctx: Context, session: Session | null, opts: { req: Request }): void {
    const url = new URL(opts.req.url);
    // Only page-ish GETs: a poll for a fragment says nothing new about where
    // somebody is looking, and assets say less than that.
    if (opts.req.method !== "GET") return;
    const agent = /^\/(?:a|agent)\/([A-Za-z0-9_-]+)/.exec(url.pathname)?.[1];
    if (!agent || agent === "new") return;

    const state = ((ctx.state as any).screen ??= { nextId: 1, pending: new Map() });
    state.here = {
        url: url.pathname + url.search,
        agentId: agent,
        at: new Date().toISOString(),
    };
}
