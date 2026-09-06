/**
 * Builds a bounded trusted plugin routing hint for the current bound website.
 *
 * Use during bound-agent system prompt assembly after refreshing the server-owned tab binding. Only mounted plugins declaring a matching domain are suggested; no workflow is loaded and no plugin operation is executed.
 * @param opts.url Fresh URL from the server-owned bound browser context, not from page text.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Fresh URL from the server-owned bound browser context, not from page text. */
        url: string;
    },
): Promise<string> {
    const matches = (await ctx.fns.plugins.forUrl({ url: opts.url })).slice(0, 4);
    if (!matches.length) return '';
    const metadata = matches.map(p => ({ name: p.name.slice(0, 100), capability: p.description, read: 'await ctx.fns.plugins.read({ name: ' + JSON.stringify(p.name.slice(0, 100)) + ' })' }));
    const json = JSON.stringify(metadata).replace(/[<>&]/g, c => String.fromCharCode(92) + 'u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
    return ['', '', '## Trusted site plugin routing (installed package metadata)',
        'Prefer these site plugins for their documented capabilities. Read the selected plugin workflow first via the read instruction below; this domain match is only a routing hint, not permission to execute. The plugin may use an API or local mirror rather than the current UI; do not claim it has read this tab. Bound CDP guards still apply: this hint authorizes no other tabs or sessions. If a workflow needs another tab, ask permission and follow the supported approval flow; never bypass the guard.',
        json].join(String.fromCharCode(10));
}
