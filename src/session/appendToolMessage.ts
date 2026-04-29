export default function (ctx: Context, id: string, toolCallId: string, content: string, ts = Date.now()) {
    return ctx.fns.session.appendMessage(ctx, id, { role: "tool", tool_call_id: toolCallId, content }, ts);
}
