// Render a marker call back to its wire-format text.
export default function (_ctx: Context, opts: { call: types.agent.MarkerCall }): string {
    const { call } = opts;
    if (call.kind === 'write') return `§write:${call.path}\n${call.content}`;
    if (call.kind === 'html') return `§html\n${call.content}`;
    if (call.kind === 'bash') return `§bash\n${call.content}`;
    if (call.kind === 'read') return `§read${call.format && call.format !== 'plain' ? ':' + call.format : ''}\n${call.path}`;
    if (call.kind === 'grep') return `§grep${call.format && call.format !== 'plain' ? ':' + call.format : ''}\n${call.content}`;
    if (call.kind === 'edit') return `§edit${call.format ? ':' + call.format : ''}\n${call.content}`;
    return `§eval\n${call.content}`;
}