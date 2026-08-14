// POST /screen/press — the person answering a live step: Next, their own click
// on the lit control ("did-it"), Stop, a step that could not be done
// ("failed"), or stepping over one ("skipped"). A beacon like /screen/here:
// fire and forget, nobody waits.
//
// The press is the floor coming back to whoever guides, and the chat is where
// guiding happens — so every press goes to the `screen.press` point, which the
// workspace answers by putting one line of fact in the chat agent's queue. In
// a host where nobody answers (no agent), the press simply dissolves: a tour
// with no guide has nobody to tell.
/**
 * Receives a guided-tour control press from the browser.
 * @param opts.req Incoming HTTP request.
 */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request }) {
    const said: any = await opts.req.json().catch(() => null);
    if (!said?.pressed) return new Response(null, { status: 204 });
    await ctx.fns.procs.hooks.run({
        name: "screen.press",
        opts: {
            pressed: String(said.pressed), say: String(said.say ?? ""),
            ...(said.stuck ? { stuck: String(said.stuck) } : {}),
            url: String(said.url ?? ""), at: String(said.at ?? new Date().toISOString()),
        },
    }).catch(() => undefined);
    return new Response(null, { status: 204 });
}
