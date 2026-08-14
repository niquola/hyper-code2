// Reply into a thread (prefixes Re: if missing). ctx.fns.gmail.reply({ threadId, to, subject, body })
/**
 * Reply to an existing Gmail thread.
 *
 * @param opts - Options for the operation.
 * @param opts.threadId - Gmail thread identifier.
 * @param opts.to - Recipient address or addresses.
 * @param opts.subject - Message subject.
 * @param opts.body - Request body or message body, as applicable.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (ctx: Context, session: Session | null, opts: { threadId: string; to: string; subject: string; body: string; account?: string }) {
    const subject = opts.subject.startsWith("Re:") ? opts.subject : `Re: ${opts.subject}`;
    return ctx.fns.gmail.send({ to: opts.to, subject, body: opts.body, threadId: opts.threadId, account: opts.account });
}
