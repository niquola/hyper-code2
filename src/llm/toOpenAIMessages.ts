// Convert our canonical transcript into OpenAI chat-completions messages[].
//
// Markers transcripts pass through unchanged (role/content strings). A
// JSON-protocol transcript carries `tool_calls` as [{ id, name, args }] on the
// assistant row and `tool_call_id` on the answer; OpenAI wants the call's
// arguments as a JSON *string* inside a `function` wrapper, and the answer as
// its own `role: "tool"` message.
//
// An assistant message that only called tools has no content — OpenAI accepts
// null there, and some proxies reject "" — so the field is omitted rather than
// sent empty.
export default function (_ctx: Context, _session: Session | null, opts: { messages: any[] }): any[] {
    const out: any[] = [];

    for (const m of opts.messages) {
        if (m?.role === "tool") {
            out.push({ role: "tool", tool_call_id: m.tool_call_id, content: String(m.content ?? "") });
            continue;
        }

        const text = String(m?.content ?? "");
        const calls = m?.tool_calls ?? [];
        if (!calls.length) {
            if (m?.role) out.push({ role: m.role, content: text });
            continue;
        }

        const msg: any = { role: "assistant", tool_calls: calls.map((c: any) => ({
            id: c.id,
            type: "function",
            function: { name: c.name, arguments: JSON.stringify(c.args ?? {}) },
        })) };
        if (text.trim() !== "") msg.content = text;
        out.push(msg);
    }

    return out;
}
