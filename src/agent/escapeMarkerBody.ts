// Escape a marker BODY so that serialize(parse(x)) === x — i.e. so a body line
// that itself begins with `§` (a marker token, or a bare `§` close) is NOT
// re-interpreted as structure when the wire text is parsed again.
//
// Only column-1 `§` is structural to the parser (markers must start at col 1,
// preceded by `\n` or string start), so only those are escaped — a `§` in the
// middle of a line is left untouched (no escape noise). Already-escaped `\§`
// is left as-is (idempotent).
//
// Inverse of the `unescape` step inside ctx.fns.agent.parseMarkers
// (`\§` → `§`). The serialize→parse round-trip tests guard that the pair agrees.
export default function (_ctx: Context, opts: { body: string }): string {
    return String(opts.body ?? "").replace(/(^|\n)(\\?)§/g, (_m, nl, bs) => bs ? nl + bs + "§" : nl + "\\§");
}
