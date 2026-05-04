// Parse the body of a §read marker.
// Two accepted forms — pick by content, NOT by stray colons:
//
//   1. PATH ONLY (single line, possibly with leading/trailing whitespace):
//        src/agent/foo.ts
//
//   2. KV BLOCK — explicit `path: ...` line, plus optional startLine /
//      endLine / maxLines lines. Any unknown key throws so typos like
//      `maxLines = 10` or full-width colons surface immediately.
//
//        path: src/agent/foo.ts
//        startLine: 30
//        endLine: 80
//
// Multi-line bodies WITHOUT a `path:` line throw — common bug pattern is
// the model writing the path on line 1 and `maxLines: 10` on line 2,
// which previously got coerced into a single broken path string and
// produced an ENOENT against `<path>\nmaxLines: 10`.
const KNOWN_KEYS = new Set(["path", "startLine", "endLine", "maxLines"]);

export default function (
    _ctx: Context,
    opts: { body: string },
): { path: string; startLine?: number; endLine?: number; maxLines?: number } {
    const body = String(opts.body ?? "").trim();
    if (!body) throw new Error("read requires a path");

    const lines = body.split("\n").map(x => x.trim()).filter(Boolean);

    // Form 1: single line, no recognised key prefix → treat the whole
    // body as the path.
    if (lines.length === 1 && !startsWithKnownKey(lines[0]!)) {
        return { path: lines[0]! };
    }

    // Form 2: kv block. Build the dict; reject anything that isn't either
    // a known key or a duplicate. This catches the multi-line "path on
    // line 1 + opt on line 2" footgun by name.
    const kv: Record<string, string> = {};
    for (const line of lines) {
        const i = line.indexOf(":");
        if (i < 0) {
            throw new Error(
                `read: line ${JSON.stringify(line)} is missing 'key: value' — `
                + `multi-line bodies must use 'path: <path>' on its own line, `
                + `then optional startLine / endLine / maxLines.`,
            );
        }
        const key = line.slice(0, i).trim();
        const value = line.slice(i + 1).trim();
        if (!KNOWN_KEYS.has(key)) {
            throw new Error(
                `read: unknown key ${JSON.stringify(key)} (allowed: ${[...KNOWN_KEYS].join(", ")})`,
            );
        }
        if (kv[key] != null) throw new Error(`read: duplicate key ${JSON.stringify(key)}`);
        kv[key] = value;
    }

    if (!kv.path) throw new Error("read requires 'path: ...'");

    const out: { path: string; startLine?: number; endLine?: number; maxLines?: number } = {
        path: kv.path,
    };
    if (kv.startLine != null) {
        const n = Number(kv.startLine);
        if (!Number.isFinite(n)) throw new Error(`read: startLine must be a number, got ${JSON.stringify(kv.startLine)}`);
        out.startLine = n;
    }
    if (kv.endLine != null) {
        const n = Number(kv.endLine);
        if (!Number.isFinite(n)) throw new Error(`read: endLine must be a number, got ${JSON.stringify(kv.endLine)}`);
        out.endLine = n;
    }
    if (kv.maxLines != null) {
        const n = Number(kv.maxLines);
        if (!Number.isFinite(n)) throw new Error(`read: maxLines must be a number, got ${JSON.stringify(kv.maxLines)}`);
        out.maxLines = n;
    }
    return out;
}

function startsWithKnownKey(line: string): boolean {
    const i = line.indexOf(":");
    if (i < 0) return false;
    return KNOWN_KEYS.has(line.slice(0, i).trim());
}
