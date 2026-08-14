// Build a terminal HTML response payload for agent.run.
//
// Deliberately does NOT write messages or events: a tool result must be stored
// first so the provider transcript remains assistant(tool_call) → tool(result)
// → assistant(final). agent.run recognizes this payload, sanitizes the HTML,
// publishes the final assistant row/event, and ends the turn without another
// LLM call.
/** Respond html for the runtime.  * @param opts.html HTML fragment to sanitize and display.
 * @param opts.text Plain-text transcript fallback.
*/
export default function (
    _ctx: Context,
    _session: Session | null,
    opts: {
        /** HTML content for display. */
    html: string;
        /** Text used by the operation. */
    text: string },
): {
    output: string;
    terminal: { type: 'html'; html: string; text: string };
} {
    return {
        output: 'HTML response accepted; it will be sanitized and shown as the final answer.',
        terminal: {
            type: 'html',
            html: String(opts.html),
            text: String(opts.text),
        },
    };
}
