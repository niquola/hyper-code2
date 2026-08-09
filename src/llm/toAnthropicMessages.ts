// Convert markers-protocol messages (role: 'user' | 'assistant', content string)
// into Anthropic messages[] form. System messages are skipped (Anthropic takes
// them at the top level as a separate `system` field).
//
// Two Anthropic invariants this guards, so a malformed transcript can never
// 400 the request:
//   1. Text content blocks must be NON-EMPTY ("text content blocks must be
//      non-empty"). A message whose content is null / "" / whitespace — e.g. a
//      legacy null-content row, an empty user POST, or a dropped tool turn —
//      would otherwise emit `{type:"text", text:""}` and reject the whole call.
//      → we drop such messages entirely.
//   2. Roles must alternate. Dropping a message can leave two same-role
//      neighbours adjacent, which is also rejected.
//      → we coalesce consecutive same-role messages into one (joined by \n\n).
export default function (_ctx: Context, _session: Session | null, opts: { messages: any[] }): any[] {
    const out: { role: "user" | "assistant"; content: { type: "text"; text: string }[] }[] = [];
    for (const m of opts.messages) {
        const role = m?.role;
        if (role !== "user" && role !== "assistant") continue; // system/other handled elsewhere
        const text = String(m.content ?? "");
        if (text.trim() === "") continue; // never emit an empty text block
        const prev = out.length > 0 ? out[out.length - 1] : undefined;
        const prevBlock = prev?.content[0];
        if (prev && prevBlock && prev.role === role) {
            prevBlock.text += "\n\n" + text; // keep roles alternating after drops
        } else {
            out.push({ role, content: [{ type: "text", text }] });
        }
    }
    return out;
}
