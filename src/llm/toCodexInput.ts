// Convert markers-protocol messages → OpenAI Responses API `input` array.
// System messages are pulled out and returned as `instructions` (the
// Responses API takes them at the top level).
export default function (
    _ctx: Context,
    opts: { messages: { role: string; content?: any }[] },
): { instructions: string; input: any[] } {
    const messages = opts.messages;
    let instructions = "";
    const input: any[] = [];

    for (const m of messages) {
        if (m.role === "system") {
            instructions = typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "");
            continue;
        }
        if (m.role === "user") {
            const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "");
            input.push({ type: "message", role: "user", content: [{ type: "input_text", text }] });
            continue;
        }
        if (m.role === "assistant") {
            const text = typeof m.content === "string" ? m.content : "";
            if (text) {
                input.push({ type: "message", role: "assistant", content: [{ type: "output_text", text }] });
            }
            continue;
        }
    }
    return { instructions, input };
}
