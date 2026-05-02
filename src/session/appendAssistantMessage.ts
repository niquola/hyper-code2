export default function (ctx: Context, id: string, msg: { content?: string }, ts = Date.now()) {
    return ctx.fns.session.appendMessage(ctx, id, {
        role: 'assistant',
        ...(msg.content ? { content: msg.content } : {}),
    }, ts);
}
