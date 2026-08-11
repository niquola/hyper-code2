// Edit the content of a message you posted. WRITE (PATCH /messages/<id>).
// ctx.fns.zulip.edit({ id, content, instance? }) → { id }
export default async function (ctx: Context, session: Session | null, opts: { id: number; content: string; instance?: string }) {
    if (!opts?.id || !opts?.content) throw new Error("zulip.edit: id and content required");
    await ctx.fns.zulip.api({ path: `/messages/${opts.id}`, method: "PATCH", form: { content: opts.content }, instance: opts.instance });
    return { id: opts.id };
}
