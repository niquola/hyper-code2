export default function (_ctx: Context, message: any): {
    chars: number;
    bytes: number;
    tokenEstimate: number;
    parts: { role: number; content: number; toolCalls: number; toolCallId: number; overhead: number };
} {
    const role = String(message?.role ?? "");
    const content = typeof message?.content === "string"
        ? message.content
        : (message?.content == null ? "" : JSON.stringify(message.content));
    const toolCalls = message?.tool_calls ? JSON.stringify(message.tool_calls) : "";
    const toolCallId = String(message?.tool_call_id ?? "");

    const parts = {
        role: role.length,
        content: content.length,
        toolCalls: toolCalls.length,
        toolCallId: toolCallId.length,
        overhead: 8,
    };

    const chars = parts.role + parts.content + parts.toolCalls + parts.toolCallId;
    const bytes = new TextEncoder().encode(role + content + toolCalls + toolCallId).length;
    const tokenEstimate = Math.ceil(chars / 4) + parts.overhead;

    return {
        chars,
        bytes,
        tokenEstimate,
        parts,
    };
}
