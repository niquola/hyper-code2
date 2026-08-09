export default async function (ctx: Context, _session: Session | null, opts: { id: string; msg: { content?: string }; ts?: number }) {
    const { id, msg } = opts;
    const ts = opts.ts ?? Date.now();
    return await ctx.fns.session.appendMessage({
        id,
        message: {
            role: 'assistant',
            ...(msg.content ? { content: msg.content } : {}),
        },
        ts,
    });
}
