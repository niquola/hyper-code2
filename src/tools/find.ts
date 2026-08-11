// Find files by glob. Declared by $tool_find.md; callable by hand as
// ctx.fns.tools.find({ pattern: "**/*.test.ts" }).
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { pattern: string; path?: string; limit?: number; noIgnore?: boolean; hidden?: boolean; timeout?: number },
): Promise<string> {
    const limit = Math.max(1, opts.limit ?? 200);
    const rows = await ctx.fns.files.find({ ...opts, limit });
    const notes: string[] = [];
    if (!rows.length) notes.push("(no files matched)");
    if (rows.length >= limit) notes.push(`NOTE: stopped at the limit of ${limit} paths — narrow the pattern or raise limit.`);
    return [rows.join("\n"), ...notes].filter(Boolean).join(rows.length && notes.length ? "\n\n" : "");
}
