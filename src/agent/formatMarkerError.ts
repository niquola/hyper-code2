// Render a parse error as a synthetic block the model sees in the next turn's
// result message. Mirrors formatMarkerResult's `§result:...` shape but with
// `§error:marker-<kind>` so the model can distinguish.
//
// Note: under strict parsing, parseMarkers no longer emits these — misplaced
// markers are silently treated as content. Kept as a utility for future
// error types or downstream tools that may want to format their own.
export default function (_ctx: Context, opts: { error: types.agent.MarkerParseError }): string {
    const e = opts.error;
    return `§error:marker-${e.kind}\n${e.hint}`;
}
