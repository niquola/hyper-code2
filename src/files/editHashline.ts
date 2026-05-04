function splitLinesKeepEmpty(s: string): string[] {
    return s.replaceAll("\r\n", "\n").split("\n");
}

function validateAnchor(ctx: Context, base: string[], anchor: string): number {
    const { line, hash } = ctx.fns.files.parseAnchor(ctx, { anchor });
    const actual = base[line - 1];
    if (actual == null) throw new Error(`anchor out of range: ${anchor}`);
    const actualHash = ctx.fns.files.lineHash(ctx, { line, text: actual });
    if (actualHash !== hash) {
        throw new Error(`stale anchor ${anchor}: expected ${hash}, got ${actualHash} on line ${line}`);
    }
    return line;
}

type PlannedOp =
    | { kind: "insert_before" | "insert_after"; index: number; lines: string[]; order: number }
    | { kind: "delete" | "replace"; start: number; end: number; lines?: string[]; order: number };

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }) {
    return a.start <= b.end && b.start <= a.end;
}

export default async function (
    ctx: Context,
    opts: { input: string },
): Promise<{ path: string; bytes: number; diff: string; content: string }> {
    const parsed = ctx.fns.files.parseHashlineEdit(ctx, { input: opts.input });
    const before = await ctx.fns.files.read(ctx, { path: parsed.path });
    const hadTrailingNl = before.endsWith("\n");
    const base = splitLinesKeepEmpty(before);

    const planned: PlannedOp[] = parsed.ops.map((op, order) => {
        if (op.kind === "insert_after") {
            const index = op.anchor === "BOF" ? 0 : op.anchor === "EOF" ? base.length : validateAnchor(ctx, base, op.anchor);
            return { kind: "insert_after", index, lines: op.lines, order };
        }
        if (op.kind === "insert_before") {
            const index = op.anchor === "BOF" ? 0 : op.anchor === "EOF" ? base.length : validateAnchor(ctx, base, op.anchor) - 1;
            return { kind: "insert_before", index, lines: op.lines, order };
        }
        if (op.kind === "delete") {
            const start = validateAnchor(ctx, base, op.start) - 1;
            const end = (op.end ? validateAnchor(ctx, base, op.end) : start + 1) - 1;
            return { kind: "delete", start, end, order };
        }
        if (op.kind === "replace") {
            const start = validateAnchor(ctx, base, op.start) - 1;
            const end = (op.end ? validateAnchor(ctx, base, op.end) : start + 1) - 1;
            return { kind: "replace", start, end, lines: op.lines, order };
        }
        throw new Error(`unknown edit op: ${(op as any).kind}`);
    });

    const ranged = planned.filter((x): x is Extract<PlannedOp, { start: number; end: number }> => "start" in x);
    for (let i = 0; i < ranged.length; i++) {
        for (let j = i + 1; j < ranged.length; j++) {
            if (overlaps(ranged[i]!, ranged[j]!)) {
                throw new Error(`overlap conflict between ops at base ranges ${ranged[i]!.start + 1}-${ranged[i]!.end + 1} and ${ranged[j]!.start + 1}-${ranged[j]!.end + 1}`);
            }
        }
    }

    const insertsByIndex = new Map<number, { before: string[][]; after: string[][] }>();
    for (const op of planned) {
        if (!("index" in op)) continue;
        const bucket = insertsByIndex.get(op.index) ?? { before: [], after: [] };
        if (op.kind === "insert_before") bucket.before.push(op.lines);
        else bucket.after.push(op.lines);
        insertsByIndex.set(op.index, bucket);
    }

    const replaceByStart = new Map<number, Extract<PlannedOp, { kind: "replace" | "delete"; start: number; end: number; lines?: string[] }>>();
    for (const op of ranged) replaceByStart.set(op.start, op);

    const out: string[] = [];
    const pushGroups = (groups: string[][]) => {
        for (const g of groups) out.push(...g);
    };

    for (let i = 0; i <= base.length; i++) {
        const edge = insertsByIndex.get(i);
        if (edge) pushGroups(edge.before);

        if (i === base.length) {
            if (edge) pushGroups(edge.after);
            break;
        }

        const rangedOp = replaceByStart.get(i);
        if (rangedOp) {
            if (rangedOp.kind === "replace") out.push(...(rangedOp.lines ?? []));
            if (edge) pushGroups(edge.after);
            i = rangedOp.end;
            continue;
        }

        out.push(base[i]!);
        if (edge) pushGroups(edge.after);
    }

    let content = out.join("\n");
    if (hadTrailingNl && !content.endsWith("\n")) content += "\n";
    const diff = await ctx.fns.markdown.highlight(ctx, {
        code: `--- ${parsed.path}\n+++ ${parsed.path}\n${before}\n---\n${content}`,
        lang: "diff",
    }).catch(() => "");
    const res = await ctx.fns.files.write(ctx, { path: parsed.path, content });
    return { path: parsed.path, bytes: res.bytes, diff, content };
}