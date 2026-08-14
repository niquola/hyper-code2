/**
 * List topics in a channel. Resolves the channel name (case-insensitive) to its
 * stream id, then queries /users/me/<id>/topics.
 *   ctx.fns.zulip.topics({ channel: "implementers", instance: "fhir" })
 * → [{ name, maxId }]  (newest topic first, as Zulip returns)
 */
/**
 * Lists topics in a Zulip channel.
 *
 * @param ctx Runtime context.
 * @param session Active session, when available.
 * @param opts Operation options.
 * @returns The operation result.
 */
export default async function (ctx: Context, session: Session | null, opts: {
        /** Zulip channel name. */
        channel: string;
        /** Configured Zulip instance name. */
        instance?: string;
    }) {
    if (!opts?.channel) throw new Error("zulip.topics: channel required");
    const channels = await ctx.fns.zulip.channels({ instance: opts.instance });
    const ch = channels.find((c: any) => c.name.toLowerCase() === opts.channel.toLowerCase());
    if (!ch) throw new Error(`Channel not found: ${opts.channel}`);

    const data = await ctx.fns.zulip.api({ path: `/users/me/${ch.id}/topics`, instance: opts.instance });
    return (data.topics || []).map((t: any) => ({ name: t.name, maxId: t.max_id }));
}
