// Convert markers-protocol messages (role: 'user' | 'assistant', content string)
// into Anthropic messages[] form. System messages are skipped (Anthropic takes
// them at the top level as a separate `system` field).
export default function (_ctx: Context, opts: { messages: any[] }): any[] {
    const messages = opts.messages;
    const out: any[] = [];
    for (const m of messages) {
        if (m.role === "system") continue;
        if (m.role === "user") {
            out.push({ role: "user", content: [{ type: "text", text: String(m.content ?? "") }] });
            continue;
        }
        if (m.role === "assistant") {
            out.push({ role: "assistant", content: [{ type: "text", text: String(m.content ?? "") }] });
            continue;
        }
    }
    return out;
}
