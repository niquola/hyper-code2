export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { pattern: string; path?: string; glob?: string; caseSensitive?: boolean; max?: number },
): Promise<Array<types.files.GrepMatch & { anchor: string }>> {
    const rows = await ctx.fns.files.grep(opts);
    return rows.map(r => ({
        ...r,
        anchor: `${r.line}${ctx.fns.files.lineHash({ line: r.line, text: r.text })}`,
    }));
}