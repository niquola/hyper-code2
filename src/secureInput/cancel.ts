/**
 * Cancel the active secure-input prompt from the agent side and close its modal in every browser
 *
 * Rejects the pending secureInput.prompt promise with a cancellation error and emits the
 * closed event so the popup disappears without the human pressing Cancel. Use when the
 * flow that asked for the value is abandoned, or when a stale prompt blocks a new one
 * (secureInput.prompt throws "already active"). Returns false when nothing was open.
 * @param opts.id Optional prompt id; when omitted the currently active prompt is cancelled.
 * @param opts.reason Optional reason recorded in the rejection error message.
 */
export default function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Optional prompt id; when omitted the currently active prompt is cancelled. */
        id?: string;
        /** Optional reason recorded in the rejection error message. */
        reason?: string;
    },
): { cancelled: boolean; id: string | null } {
    const secureState = ((ctx.state as any).secureInput ??= {});
    const prompts: Map<string, any> = (secureState.prompts ??= new Map());
    const prompt = opts.id ? prompts.get(String(opts.id)) : prompts.values().next().value;
    if (!prompt) {
        // Nothing pending: also drop a lingering "closing" marker so the next prompt may open.
        delete secureState.closing;
        return { cancelled: false, id: null };
    }
    prompts.delete(prompt.id);
    prompt.reject(new Error(opts.reason ? `transient input prompt cancelled: ${String(opts.reason)}` : "transient input prompt cancelled by agent"));
    return { cancelled: true, id: String(prompt.id) };
}
