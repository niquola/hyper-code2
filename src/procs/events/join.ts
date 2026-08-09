// Someone opened a stream. Returns the leave fn, so the route cannot forget to
// call it — the connection and the presence have exactly the same lifetime.
//
// Without a session (AUTH=off) everyone is the same anonymous person, which is
// the truth: the workspace has no way to tell them apart and pretending
// otherwise would put ghosts in the bar.
export default function (ctx: Context, session: Session | null, _opts?: {}): () => void {
    const user = (session as any)?.user;
    const id = user?.sub ?? "local";
    const name = user?.name ?? "you";

    const presence = ((ctx.state.procs.events ??= {}).presence ??= new Map());
    const there = presence.get(id);
    if (there) there.tabs += 1;
    else presence.set(id, { id, name, tabs: 1 });
    ctx.fns.procs.events.emit({ event: { type: "presence" } });

    let left = false;
    return () => {
        if (left) return;                       // abort can fire more than once
        left = true;
        const p = presence.get(id);
        if (!p) return;
        p.tabs -= 1;
        if (p.tabs <= 0) presence.delete(id);
        ctx.fns.procs.events.emit({ event: { type: "presence" } });
    };
}
