// Diagnostics from parseMarkers when a candidate marker is found at a position
// that LOOKS like a marker (followed by a newline) but isn't valid syntax —
// most commonly, marker not at column 1 because the model forgot the leading \n.
//
// Fed back to the model in a result message so it can self-correct.
export type MarkerParseError = {
    kind: 'misplaced';
    marker: 'eval' | 'write';
    position: number;
    hint: string;
};
