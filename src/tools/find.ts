// Find files by glob. Declared by $tool_find.md; callable by hand as
// ctx.fns.tools.find({ pattern: "**/*.test.ts" }).
/** Implements workspace glob search. */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { /** Glob or search pattern. */ pattern: string; /** Workspace-relative path. */ path?: string; /** Maximum number of results. */ limit?: number; /** Whether to include ignored files. */ noIgnore?: boolean; /** Whether to include hidden paths. */ hidden?: boolean; /** Timeout in seconds. */ timeout?: number },
): Promise<string> {
    const limit = Math.max(1, opts.limit ?? 200);
    const rows = await ctx.fns.files.find({ ...opts, limit });
    const notes: string[] = [];
    if (!rows.length) notes.push("(no files matched)");
    if (rows.length >= limit) notes.push(`NOTE: stopped at the limit of ${limit} paths — narrow the pattern or raise limit.`);
    return [rows.join("\n"), ...notes].filter(Boolean).join(rows.length && notes.length ? "\n\n" : "");
}
