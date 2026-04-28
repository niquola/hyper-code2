// Convert OpenAI chat-completions messages → OpenAI Responses API `input` array.
// Pulls the `system` message out of `messages` and returns it separately as
// `instructions` (Responses API takes it at the top level).
//
// Mapping:
//   {role:"user", content:"..."}                              → {type:"message", role:"user",      content:[{type:"input_text",text}]}
//   {role:"assistant", content:"..."}                         → {type:"message", role:"assistant", content:[{type:"output_text",text}]}
//   {role:"assistant", tool_calls:[{id,function:{name,args}}]}→ {type:"function_call", call_id, name, arguments: stringified}
//   {role:"tool", tool_call_id, content}                       → {type:"function_call_output", call_id, output}
export default function (
    _ctx: Context,
    messages: { role: string; content?: any; tool_calls?: any[]; tool_call_id?: string }[],
): { instructions: string; input: any[] } {
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
            for (const tc of m.tool_calls ?? []) {
                input.push({
                    type: "function_call",
                    call_id: tc.id,
                    name: tc.function?.name ?? tc.name,
                    arguments: tc.function?.arguments ?? tc.arguments ?? "{}",
                });
            }
            continue;
        }
        if (m.role === "tool") {
            input.push({
                type: "function_call_output",
                call_id: m.tool_call_id,
                output: typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? ""),
            });
            continue;
        }
    }
    return { instructions, input };
}
