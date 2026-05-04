export default function (
    _ctx: Context,
    opts: { body: string },
): { path: string; startLine?: number; endLine?: number; maxLines?: number } {
    const body = String(opts.body ?? "").trim();
    if (!body) throw new Error("read requires a path");

    const lines = body.split("\n").map(x => x.trim()).filter(Boolean);
    const kvLike = lines.some(line => line.includes(":"));

    if (!kvLike) return { path: body };

    const kv = Object.fromEntries(lines.map(line => {
        const i = line.indexOf(":");
        return i >= 0 ? [line.slice(0, i).trim(), line.slice(i + 1).trim()] : [line, ""];
    }));

    if (!kv.path) throw new Error("read requires 'path: ...'");

    const out: { path: string; startLine?: number; endLine?: number; maxLines?: number } = {
        path: kv.path,
    };
    if (kv.startLine) out.startLine = Number(kv.startLine);
    if (kv.endLine) out.endLine = Number(kv.endLine);
    if (kv.maxLines) out.maxLines = Number(kv.maxLines);
    return out;
}