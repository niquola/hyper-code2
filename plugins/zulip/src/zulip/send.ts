// Post a message to a channel/topic (WRITE — sends a real message). Markdown is
// supported in `content`.
//   ctx.fns.zulip.send({ channel: "general", topic: "Test", content: "Hello", instance: "fhir" })
// → { id }
export default async function (
    ctx: Context,
    session: Session | null,
    opts: { channel: string; topic: string; content: string; instance?: string },
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
