// Append text to the end of an existing Google Doc. WRITE OP.
// Computes the end index from the doc body so text lands after current content.
// ctx.fns.gdoc.append({ id: "1Bxi...Ms", text: "\nNew line" })
// → { id, appended: <chars> }
/**
 * Append content to a Google document.
 *
 * @param opts - Options for the operation.
 * @param opts.id - Resource identifier.
 * @param opts.text - Text content.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (ctx: Context, session: Session | null, opts: { id: string; text: string; account?: string }) {
    if (!opts?.id || opts?.text == null) throw new Error("id and text required");
    const id = (opts.id.match(/\/document\/d\/([a-zA-Z0-9_-]+)/) || [])[1] || opts.id.trim();
    const doc = await ctx.fns.gdoc.api({ url: `https://docs.googleapis.com/v1/documents/${id}`, account: opts.account });
    const content = doc.body?.content || [];
    // Last structural element's endIndex is the doc end; insert one before the trailing newline.
    const endIndex = content.length ? content[content.length - 1].endIndex : 1;
    const insertAt = Math.max(1, endIndex - 1);
    await ctx.fns.gdoc.api({
        url: `https://docs.googleapis.com/v1/documents/${id}:batchUpdate`,
        method: "POST",
        body: { requests: [{ insertText: { location: { index: insertAt }, text: opts.text } }] },
        account: opts.account,
    });
    return { id, appended: opts.text.length };
}
