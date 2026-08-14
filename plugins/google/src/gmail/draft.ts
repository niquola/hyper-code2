// Create a draft. ctx.fns.gmail.draft({ to, subject, body })
/**
 * Create a Gmail draft.
 *
 * @param opts - Options for the operation.
 * @param opts.to - Recipient address or addresses.
 * @param opts.subject - Message subject.
 * @param opts.body - Request body or message body, as applicable.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (ctx: Context, session: Session | null, opts: { to: string; subject: string; body: string; account?: string }) {
    const raw = Buffer.from([
        `To: ${opts.to}`,
        `Subject: ${opts.subject}`,
        "Content-Type: text/plain; charset=utf-8",
        "",
        opts.body,
    ].join("\r\n")).toString("base64url");
    const res = await ctx.fns.gmail.api({ path: "/drafts", method: "POST", account: opts.account, body: { message: { raw } } });
    return { id: res.id, message: { id: res.message.id, threadId: res.message.threadId } };
}
