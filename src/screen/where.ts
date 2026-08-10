// Where the person is, without interrupting them.
//
// `readScreen` is the deep read — it stops to ask the browser and comes back
// with every entity and action on screen. This is the cheap one: the last thing
// an open tab said about itself (`POST /screen/here`, one beacon per swap),
// straight out of state, no round trip, safe to call before every reply.
//
//   ctx.fns.screen.where({})
//   → { url: "/ehr/patient/seed-anna", page: "chart", title: "…", at: "…", stale: false }
//
// `stale` is the honest part: a tab that has said nothing for a while may be
// closed, on another window, or looking at something else entirely.
export default function (ctx: Context, _session: Session | null, opts?: { staleAfterMs?: number }) {
    const here = (ctx.state.screen as any)?.here;
    if (!here) return null;
    const age = Date.now() - Date.parse(here.at);
    return { ...here, stale: age > (opts?.staleAfterMs ?? 10 * 60_000) };
}
