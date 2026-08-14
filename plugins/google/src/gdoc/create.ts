// Create a new Google Doc, optionally with initial text content. WRITE OP.
// ctx.fns.gdoc.create({ title: "Meeting Notes", content: "Agenda:\n1. ..." })
// → { id, title, link }
/**
 * Create a Google document.
 *
 * @param opts - Options for the operation.
 * @param opts.title - Resource title.
 * @param opts.content - Document content.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (ctx: Context, session: Session | null, opts: { title: string; content?: string; account?: string }) {
    if (!opts?.title) throw new Error("title required");
    const doc = await ctx.fns.gdoc.api({
        url: "https://docs.googleapis.com/v1/documents",
        method: "POST",
        body: { title: opts.title },
        account: opts.account,
    });
    if (opts.content) {
        await ctx.fns.gdoc.api({
            url: `https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`,
            method: "POST",
            body: { requests: [{ insertText: { location: { index: 1 }, text: opts.content } }] },
            account: opts.account,
        });
    }
    return {
        id: doc.documentId,
        title: doc.title,
        link: `https://docs.google.com/document/d/${doc.documentId}/edit`,
    };
}
