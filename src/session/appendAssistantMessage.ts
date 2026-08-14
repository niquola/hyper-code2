/** Append assistant message for the runtime. */
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Agent identifier. */
id: string;
        /** Msg used by the operation. */
msg: { content?: string };
        /** Ts used by the operation. */
ts?: number }) {
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
