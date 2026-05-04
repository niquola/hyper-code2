export default async function (
    ctx: Context,
    opts: { pattern: string; path?: string; glob?: string; caseSensitive?: boolean; max?: number },
): Promise<types.files.GrepMatch[]> {
    const base = opts.path ?? "";
    const absBase = ctx.fns.files.resolveSafe(ctx, { path: base });
    const glob = opts.glob ?? "**/*";
    const flags = opts.caseSensitive ? "g" : "gi";
    const re = new RegExp(opts.pattern, flags);
    const out: types.files.GrepMatch[] = [];
    for await (const rel of new Bun.Glob(glob).scan({ cwd: absBase, onlyFiles: true })) {
        const path = base ? `${base}/${rel}` : rel;
        let text = "";
        try {
            text = await ctx.fns.files.read(ctx, { path });
        } catch {
            continue;
        }
        const lines = text.replaceAll("\r\n", "\n").split("\n");
        for (let i = 0; i < lines.length; i++) {
            re.lastIndex = 0;
            const m = re.exec(lines[i] ?? "");
            if (!m) continue;
            out.push({ path, line: i + 1, column: m.index + 1, text: lines[i] ?? "" });
            if (out.length >= (opts.max ?? 50)) return out;
        }
    }
    return out;
}