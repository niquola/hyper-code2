// files.grep, with a stable anchor attached to every match — the form `edit`
// addresses lines by. Same options as grep; only the shape of a row differs.
/** Formats grep matches with stable line anchors. */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Glob or search pattern. */
        pattern: string; /** Workspace-relative path. */ path?: string; /** Glob restricting searched files. */ glob?: string; /** Whether matching is case-insensitive. */ ignoreCase?: boolean; /** Whether to treat the pattern as literal text. */ literal?: boolean;
        /** Number of context lines around each match. */
        context?: number; /** Maximum number of results. */ limit?: number; /** Whether to include ignored files. */ noIgnore?: boolean; /** Whether to include hidden paths. */ hidden?: boolean;
    },
): Promise<Array<types.files.GrepMatch & { anchor: string }>> {
    const rows = await ctx.fns.files.grep(opts);
    return rows.map(r => ({
        ...r,
        anchor: `${r.line}${ctx.fns.files.lineHash({ line: r.line, text: r.text })}`,
    }));
}
