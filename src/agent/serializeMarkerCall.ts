// Render a marker call back to its wire-format text. The body is escaped via
// ctx.fns.agent.escapeMarkerBody so a body line starting with `§` can't be
// re-read as a marker — i.e. this is a true inverse of ctx.fns.agent.parseMarkers
// (a path is structural, not a body, so it is not escaped).
export default function (ctx: Context, opts: { call: types.agent.MarkerCall }): string {
    const { call } = opts;
    const esc = (body: string) => ctx.fns.agent.escapeMarkerBody(ctx, { body });
    if (call.kind === 'write') return `§write:${call.path}\n${esc(call.content)}`;
    if (call.kind === 'html') return `§html\n${esc(call.content)}`;
    if (call.kind === 'bash') return `§bash\n${esc(call.content)}`;
    if (call.kind === 'read') return `§read${call.format && call.format !== 'plain' ? ':' + call.format : ''}\n${esc(call.path)}`;
    if (call.kind === 'grep') return `§grep${call.format && call.format !== 'plain' ? ':' + call.format : ''}\n${esc(call.content)}`;
    if (call.kind === 'edit') return `§edit${call.format ? ':' + call.format : ''}\n${esc(call.content)}`;
    return `§eval\n${esc(call.content)}`;
}