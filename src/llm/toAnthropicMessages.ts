// Convert OpenAI-chat messages (what agent.messages stores) into Anthropic messages[] form.
// Rules:
//   - {role:"user", content:"x"}          → {role:"user", content:[{type:"text", text:"x"}]}
//   - {role:"assistant", content, tool_calls?}
//                                        → {role:"assistant", content:[...text?, ...tool_use?]}
//   - CONSECUTIVE {role:"tool"} messages → one {role:"user", content:[{type:"tool_result", ...}*]}
//   - system messages are skipped (Anthropic takes them as a top-level "system" field)
export default function (messages: any[]): any[] {
    const out: any[] = [];
    let toolGroup: any[] | null = null;
    const flush = () => {
        if (toolGroup && toolGroup.length) out.push({ role: "user", content: toolGroup });
        toolGroup = null;
    };
    for (const m of messages) {
        if (m.role === "tool") {
            toolGroup ??= [];
            toolGroup.push({
                type: "tool_result",
                tool_use_id: m.tool_call_id,
                content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
            });
            continue;
        }
        flush();
        if (m.role === "system") continue;
        if (m.role === "user") {
            out.push({ role: "user", content: [{ type: "text", text: String(m.content ?? "") }] });
            continue;
        }
        if (m.role === "assistant") {
            const content: any[] = [];
            if (m.content) content.push({ type: "text", text: String(m.content) });
            for (const tc of (m.tool_calls ?? [])) {
                let input: any = {};
                try { input = JSON.parse(tc.function?.arguments ?? "{}"); } catch {}
                content.push({ type: "tool_use", id: tc.id, name: tc.function?.name, input });
            }
            out.push({ role: "assistant", content });
        }
    }
    flush();
    return out;
}
