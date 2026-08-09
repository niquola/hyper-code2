// Diagnostics from parseMarkers when something looks like a marker but
// isn't valid syntax. Fed back to the model in a result message so it can
// self-correct.
//
// kinds:
//   'unescaped' — the parser saw an unescaped `§` in prose (anywhere
//     outside a marker body). Either it should be `\§` (literal) or
//     placed at column 1 followed by \n with a known kind (eval/write/
//     bash/html) for execution. Strict — no implicit execution.
export type MarkerParseError = {
    kind: 'unescaped';
    marker?: 'eval' | 'write' | 'html' | 'bash';
    position: number;
    hint: string;
};
