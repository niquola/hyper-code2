function payload(line: string): string {
    if (!line.startsWith("|")) throw new Error(`payload line must start with |: ${line}`);
    return line.slice(1);
}

export default function (_ctx: Context, opts: { input: string }): { path: string; ops: types.files.EditHashlineOp[] } {
    const raw = String(opts.input ?? "").replaceAll("\r\n", "\n");
    const lines = raw.split("\n");
    let i = 0;
    while (i < lines.length && !lines[i]!.trim()) i++;
    const header = lines[i] ?? "";
    if (!header.startsWith("@")) throw new Error("first non-blank line must be @PATH");
    const path = header.slice(1).trim();
    if (!path) throw new Error("missing path in @PATH header");
    i++;

    const ops: types.files.EditHashlineOp[] = [];
    while (i < lines.length) {
        const line = lines[i] ?? "";
        if (!line.trim()) {
            i++;
            continue;
        }
        if (line.startsWith("+ ") || line === "+ BOF" || line === "+ EOF") {
            const anchor = line.slice(2).trim() as any;
            i++;
            const payloads: string[] = [];
            while (i < lines.length && (lines[i] ?? "").startsWith("|")) payloads.push(payload(lines[i++]!));
            if (!payloads.length) throw new Error(`insert requires at least one payload line after: ${line}`);
            ops.push({ kind: "insert_after", anchor, lines: payloads });
            continue;
        }
        if (line.startsWith("< ") || line === "< BOF" || line === "< EOF") {
            const anchor = line.slice(2).trim() as any;
            i++;
            const payloads: string[] = [];
            while (i < lines.length && (lines[i] ?? "").startsWith("|")) payloads.push(payload(lines[i++]!));
            if (!payloads.length) throw new Error(`insert requires at least one payload line after: ${line}`);
            ops.push({ kind: "insert_before", anchor, lines: payloads });
            continue;
        }
        if (line.startsWith("- ")) {
            const range = line.slice(2).trim();
            const [start, end] = range.split("..");
            ops.push({ kind: "delete", start: start!.trim(), end: end?.trim() || undefined });
            i++;
            continue;
        }
        if (line.startsWith("= ")) {
            const range = line.slice(2).trim();
            const [start, end] = range.split("..");
            i++;
            const payloads: string[] = [];
            while (i < lines.length && (lines[i] ?? "").startsWith("|")) payloads.push(payload(lines[i++]!));
            ops.push({ kind: "replace", start: start!.trim(), end: end?.trim() || undefined, lines: payloads });
            continue;
        }
        throw new Error(`unrecognized op: ${line}`);
    }

    return { path, ops };
}