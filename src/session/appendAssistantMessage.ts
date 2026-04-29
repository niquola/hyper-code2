export default function (ctx: Context, id: string, msg: { content?: string; tool_calls?: any[] }, ts = Date.now()) {
    const out: any = { role: "assistant" };
    if (msg.content) out.content = msg.content;
    if (msg.tool_calls?.length) out.tool_calls = msg.tool_calls;
    return ctx.fns.session.appendMessage(ctx, id, out, ts);
}
