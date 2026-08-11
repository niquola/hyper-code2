// Read a file, optionally a line range, optionally in hashline form (anchors
// instead of line numbers — what `edit` consumes). Declared by $tool_read.md;
// callable by hand as ctx.fns.tools.read({ path, hashline: true }).
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { path: string; startLine?: number; endLine?: number; maxLines?: number; hashline?: boolean },
): Promise<string> {
    if (opts.hashline) {
        const r = await ctx.fns.files.readHashline({
            path: opts.path, startLine: opts.startLine, endLine: opts.endLine, maxLines: opts.maxLines,
        });
        return r.text;
    }
    const text = await ctx.fns.files.read({ path: opts.path });
    const start = Math.max(1, opts.startLine ?? 1);
    const lines = text.replaceAll("\r\n", "\n").split("\n");
    let end = Math.max(start, opts.endLine ?? lines.length);
    if (opts.maxLines != null) end = Math.min(end, start + Math.max(0, opts.maxLines - 1));
    return lines.slice(start - 1, end).join("\n");
}
