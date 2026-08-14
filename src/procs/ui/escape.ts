// Escape a value for HTML text or an attribute — the one escaper. Every page in
// this repo is a template literal, so this is the most-called function in the
// kit; it is sync and allocation-free on the common path.
//
//   const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
//   `<td>${esc(patient.name)}</td>`
//
// The local alias is the idiom: `esc(...)` inside a template reads, and the one
// line at the top of the render function is what makes it the shared one. A
// helper that escapes but has no ctx should take one — being unable to reach the
// kit is the signal that it is a renderer in disguise.
//
// Undefined and null escape to "" rather than "undefined", because a missing
// field is the normal case in FHIR data and printing the word helps nobody.
const REPLACEMENTS: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };

/**
 * Perform escape for the ui subsystem.
 * @param opts.text The text to process.
 */
export default function (_ctx: Context, _session: Session | null, opts: { text: unknown }): string {
    return String(opts.text ?? "").replace(/[&<>"']/g, ch => REPLACEMENTS[ch]!);
}
