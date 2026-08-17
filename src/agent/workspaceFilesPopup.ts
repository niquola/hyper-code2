/**
 * Renders the agent workspace directory contents in a popup
 *
 * Render a compact, read-only list of the immediate files and folders in an agent workspace. Use from chat navigation when the user wants to inspect or open the current agent folder without leaving the conversation first.
 * @param opts.agentId Identifier of the agent whose workspace directory is listed.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Identifier of the agent whose workspace directory is listed. */
        agentId: string;
    },
): Promise<string> {
    const esc = (value: unknown) => ctx.fns.procs.ui.escape({ text: String(value ?? '') });
    const agent = (ctx.state as any).agent?.[opts.agentId] ?? await ctx.fns.session.load({ id: opts.agentId });
    if (!agent) return ctx.fns.ui.popupContent({ title: 'Files', html: '<p class="text-sm text-error">Agent not found</p>' });
    const dir = String(agent.workspaceDir ?? '').trim();
    if (!dir) return ctx.fns.ui.popupContent({ title: 'Files', html: '<p class="text-sm text-base-content/50">No workspace folder</p>' });
    const entries = await ctx.fns.files.list({ path: dir });
    const rows = entries.slice(0, 100).map((entry: { name: string; isDir: boolean }) => {
      const path = dir.replace(/\/$/, '') + '/' + entry.name;
      return '<a href="/files?path=' + encodeURIComponent(path) + '" class="flex min-h-9 items-center gap-2 border-t border-ui-border px-2 text-xs hover:bg-base-200/60"><i class="ph ' + (entry.isDir ? 'ph-folder' : 'ph-file') + ' shrink-0 text-base-content/45"></i><span class="min-w-0 flex-1 truncate">' + esc(entry.name) + '</span></a>';
    }).join('');
    const open = '<a href="/files?path=' + encodeURIComponent(dir) + '" class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"><i class="ph ph-arrow-square-out"></i>Open in Files</a>';
    return ctx.fns.ui.popupContent({ title: dir.split('/').filter(Boolean).pop() || dir, class: 'w-full max-w-xl', html: '<div class="mb-2 flex items-center justify-between gap-3"><code class="min-w-0 truncate text-[10px] text-base-content/45">' + esc(dir) + '</code>' + open + '</div><div class="max-h-[60vh] overflow-y-auto rounded-lg border border-ui-border">' + (rows || '<p class="p-3 text-xs text-base-content/45">Empty folder</p>') + '</div>' });
}
