// List attachments on a message. ctx.fns.gmail.attachments({ id })
/**
 * List attachments on a Gmail message.
 *
 * @param opts - Options for the operation.
 * @param opts.id - Resource identifier.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (ctx: Context, session: Session | null, opts: { id: string; account?: string }) {
    const msg = await ctx.fns.gmail.api({ path: `/messages/${opts.id}?format=full`, account: opts.account });
    const out: any[] = [];
    const walk = (parts: any[]) => {
        for (const part of parts ?? []) {
            if (part.filename && part.body?.attachmentId) {
                out.push({ attachmentId: part.body.attachmentId, filename: part.filename, mimeType: part.mimeType || "application/octet-stream", size: part.body.size || 0 });
            }
            if (part.parts) walk(part.parts);
        }
    };
    walk(msg.payload?.parts ?? []);
    if (msg.payload?.filename && msg.payload?.body?.attachmentId) {
        out.push({ attachmentId: msg.payload.body.attachmentId, filename: msg.payload.filename, mimeType: msg.payload.mimeType || "application/octet-stream", size: msg.payload.body.size || 0 });
    }
    return out;
}
