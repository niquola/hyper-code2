// Search the workspace. Declared by $tool_grep.md.
//
// Output is ripgrep's own shape, which every model has read a thousand times:
//   path:LINE:COL: matched text        (path:ANCHOR:COL: in hashline mode)
//   path-LINE- context line
// Blocks are separated by `--`, and over-long lines are cut — one minified file
// otherwise buries the whole result.
//
// Two things the model is TOLD rather than left to guess: that the result was
// cut at the limit (silence there reads as "that is everything"), and that
// ripgrep is missing so this search was slower and less thorough than it looks.
const MAX_LINE = 400;

export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        pattern: string; path?: string; glob?: string; ignoreCase?: boolean; literal?: boolean;
        context?: number; limit?: number; noIgnore?: boolean; hidden?: boolean; hashline?: boolean;
    },
): Promise<string> {
    const limit = Math.max(1, opts.limit ?? 50);
    const query = {
        pattern: opts.pattern,
        path: opts.path || undefined,
        glob: opts.glob || undefined,
        ignoreCase: opts.ignoreCase === true,
        literal: opts.literal === true,
        context: opts.context,
        limit,
        noIgnore: opts.noIgnore === true,
        hidden: opts.hidden === true,
    };

    const rows: any[] = opts.hashline
        ? await ctx.fns.files.grepHashline(query)
        : await ctx.fns.files.grep(query);

    let truncatedLines = false;
    const cut = (text: string): string => {
        const t = String(text ?? "").replaceAll("\r", "");
        if (t.length <= MAX_LINE) return t;
        truncatedLines = true;
        return `${t.slice(0, MAX_LINE)}… (+${t.length - MAX_LINE} chars)`;
    };

    const blocks = rows.map(r => {
        const head = `${r.path}:${opts.hashline ? r.anchor : r.line}:${r.column}: ${cut(r.text)}`;
        if (!opts.context) return head;
        const first = r.line - (r.before?.length ?? 0);
        return [
            ...(r.before ?? []).map((l: string, i: number) => `${r.path}-${first + i}- ${cut(l)}`),
            head,
            ...(r.after ?? []).map((l: string, i: number) => `${r.path}-${r.line + 1 + i}- ${cut(l)}`),
        ].join("\n");
    });
    const body = blocks.join(opts.context ? "\n--\n" : "\n");

    const notes: string[] = [];
    if (!ctx.fns.files.rgPath({})) {
        notes.push("WARNING: ripgrep (rg) is not installed, so this ran on the slow in-process fallback: "
            + "no .gitignore support and no parallel search. Install it — `brew install ripgrep` — and tell the user.");
    }
    if (rows.length >= limit) {
        notes.push(`NOTE: stopped at the limit of ${limit} matches — there may be more. Narrow the pattern or raise limit.`);
    }
    if (truncatedLines) notes.push(`NOTE: some lines were cut at ${MAX_LINE} chars. Read the file for the full line.`);
    if (!rows.length) notes.push("(no matches)");

    return [body, ...notes].filter(Boolean).join(body && notes.length ? "\n\n" : "");
}
