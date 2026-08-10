// Reply into a thread (prefixes Re: if missing). ctx.fns.gmail.reply({ threadId, to, subject, body })
export default async function (ctx: Context, session: Session | null, opts: { threadId: string; to: string; subject: string; body: string; account?: string }) {
    const subject = opts.subject.startsWith("Re:") ? opts.subject : `Re: ${opts.subject}`;
    return ctx.fns.gmail.send({ to: opts.to, subject, body: opts.body, threadId: opts.threadId, account: opts.account });
}
