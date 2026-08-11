// files.grep, with a stable anchor attached to every match — the form `edit`
// addresses lines by. Same options as grep; only the shape of a row differs.
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        pattern: string; path?: string; glob?: string; ignoreCase?: boolean; literal?: boolean;
        context?: number; limit?: number; noIgnore?: boolean; hidden?: boolean;
    },
): Promise<Array<types.files.GrepMatch & { anchor: string }>> {
    const rows = await ctx.fns.files.grep(opts);
    return rows.map(r => ({
        ...r,
        anchor: `${r.line}${ctx.fns.files.lineHash({ line: r.line, text: r.text })}`,
    }));
}
