// Who is here. A workspace can have several people in it — the chat is one
// conversation with one agent, so knowing who else is looking at it is the
// difference between talking to a room and talking to a wall.
//
// Presence is counted, not flagged: one person with three tabs is one person,
// and closing one tab does not make them leave. That refcount is the whole
// trick — it is what makes "who is here" survive a reload.
export default function (ctx: Context, _session: Session | null, _opts?: {}) {
    return [...(ctx.state.procs?.events?.presence ?? new Map()).values()]
        .map(p => ({ id: p.id, name: p.name, tabs: p.tabs }))
        .sort((a, b) => a.name.localeCompare(b.name));
}
