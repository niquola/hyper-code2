export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { path: string; startLine?: number; endLine?: number; maxLines?: number },
): Promise<types.files.ReadHashlineResult> {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    const content = await ctx.fns.files.read({ path: opts.path });
    const normalized = content.replaceAll("\r\n", "\n");
    const all = normalized.split("\n");
    const totalLines = all.length;
    const startLine = Math.max(1, opts.startLine ?? 1);
    let endLine = Math.max(startLine, opts.endLine ?? totalLines);
    if (opts.maxLines != null) endLine = Math.min(endLine, startLine + Math.max(0, opts.maxLines - 1));
    endLine = Math.min(endLine, totalLines);

    const lines: types.files.ReadAnchorLine[] = [];
    for (let i = startLine; i <= endLine; i++) {
        lines.push(ctx.fns.files.formatHashline({ line: i, text: all[i - 1] ?? "" }));
    }

    // Don't return huge content blobs — return only the slice metadata
    const contentTooLarge = content.length > MAX_FILE_SIZE;

    return {
        path: opts.path,
        content: contentTooLarge ? "" : content,
        lines,
        text: lines.map(x => `${x.anchor}|${x.text}`).join("\n"),
        truncated: startLine !== 1 || endLine !== totalLines || contentTooLarge,
        startLine,
        endLine,
        totalLines,
    };
}