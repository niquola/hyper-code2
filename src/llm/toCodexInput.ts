// Convert our canonical transcript → OpenAI Responses API `input` items.
// System messages are pulled out and returned as `instructions` (the Responses
// API takes them at the top level).
//
// The Responses API has no message with a tool field: a call is its own
// `function_call` ITEM and its answer is a `function_call_output` item, paired
// by call_id. So an assistant turn that both talked and called tools becomes
// several items, in order.
export default function (
    _ctx: Context,
    _session: Session | null,
    opts: { messages: { role: string; content?: any; tool_calls?: any[]; tool_call_id?: string }[] },
): { instructions: string; input: any[] } {
    const messages = opts.messages;
    let instructions = "";
    const input: any[] = [];

    for (const m of messages) {
        if (m.role === "system") {
            instructions = typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "");
            continue;
        }
        if (m.role === "tool") {
            input.push({ type: "function_call_output", call_id: m.tool_call_id, output: String(m.content ?? "") });
            continue;
        }
        if (m.role === "user") {
            const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "");
            input.push({ type: "message", role: "user", content: [{ type: "input_text", text }] });
            continue;
        }
        if (m.role === "assistant") {
            const text = typeof m.content === "string" ? m.content : "";
            if (text) input.push({ type: "message", role: "assistant", content: [{ type: "output_text", text }] });
            for (const call of m.tool_calls ?? []) {
                input.push({
                    type: "function_call",
                    call_id: call.id,
                    name: call.name,
                    arguments: JSON.stringify(call.args ?? {}),
                });
            }
            continue;
        }
    }
    return { instructions, input };
}
