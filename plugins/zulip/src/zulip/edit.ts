/**
 * Edit the content of a message you posted. WRITE (PATCH /messages/<id>).
 * ctx.fns.zulip.edit({ id, content, instance? }) → { id }
 */
/**
 * Edits a Zulip message after write confirmation.
 *
 * @param ctx Runtime context.
 * @param session Active session, when available.
 * @param opts Operation options.
 * @returns The operation result.
 */
export default async function (ctx: Context, session: Session | null, opts: {
        /** Numeric identifier. */
        id: number;
        /** Content to upload or message content. */
        content: string;
        /** Configured Zulip instance name. */
        instance?: string;
    }) {
    if (!opts?.id || !opts?.content) throw new Error("zulip.edit: id and content required");
    await ctx.fns.zulip.api({ path: `/messages/${opts.id}`, method: "PATCH", form: { content: opts.content }, instance: opts.instance });
    return { id: opts.id };
}
