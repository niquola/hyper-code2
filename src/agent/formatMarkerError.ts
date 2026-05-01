// Render a parse error as a synthetic block the model sees in the next turn's
// result message. Mirrors formatMarkerResult's `///result:...` shape but with
// `///error:marker-<kind>` so the model can distinguish.
export default function (e: types.agent.MarkerParseError): string {
    return `///error:marker-${e.kind}\n${e.hint}`;
}
