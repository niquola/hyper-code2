// Single source of truth for the markers wire-format when walking marker pairs
// (so compact / truncate / delete never strand half a pair). An assistant
// *invocation* is §eval / §write: / §bash / §html; a synthetic *result* user
// message is §result:* / §error:*. Returns the kind, or null for ordinary prose.
//
// Callers add their own role check where they have one (an invocation only ever
// appears on an assistant message, a result only on a synthetic user message).
export default function (_ctx: Context, opts: { content: any }): "invocation" | "result" | null {
    const c = String(opts.content ?? "");
    if (c.startsWith("§eval\n") || c === "§eval"
        || c.startsWith("§write:")
        || c.startsWith("§bash\n") || c === "§bash"
        || c.startsWith("§html\n") || c === "§html") return "invocation";
    if (c.startsWith("§result:") || c.startsWith("§error:")) return "result";
    return null;
}
