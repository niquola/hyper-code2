// Download an attachment to a file. ctx.fns.gmail.download({ id, attachmentId, path: "/tmp/file.pdf" })
export default async function (ctx: Context, session: Session | null, opts: { id: string; attachmentId: string; path: string; account?: string }) {
    const json = await ctx.fns.gmail.api({ path: `/messages/${opts.id}/attachments/${opts.attachmentId}`, account: opts.account });
    await Bun.write(opts.path, Buffer.from(json.data, "base64url"));
    return { saved: opts.path, size: json.size };
}
