/**
 * Post a message to a channel/topic (WRITE — sends a real message). Markdown is
 * supported in `content`.
 *   ctx.fns.zulip.send({ channel: "general", topic: "Test", content: "Hello", instance: "fhir" })
 * → { id }
 */
/**
 * Sends a Zulip channel message after write confirmation.
 *
 * @param ctx Runtime context.
 * @param session Active session, when available.
 * @param opts Operation options.
 * @returns The operation result.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Zulip channel name. */
        channel: string;
        /** Zulip topic name. */
        topic: string;
        /** Content to upload or message content. */
        content: string;
        /** Configured Zulip instance name. */
        instance?: string;
    },
) {
    if (!opts?.channel || !opts?.topic || !opts?.content) {
        throw new Error("zulip.send: channel, topic, content required");
    }
    const data = await ctx.fns.zulip.api({
        path: "/messages",
        method: "POST",
        form: { type: "stream", to: opts.channel, topic: opts.topic, content: opts.content },
        instance: opts.instance,
    });
    return { id: data.id };
}
