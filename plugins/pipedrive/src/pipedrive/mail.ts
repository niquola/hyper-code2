/** Reads one complete Pipedrive mailbox message and converts its HTML body to text. */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Numeric mailbox message ID previously returned by `pipedrive.emails`. */
        id: number;
    },
): Promise<Record<string, any>> {
    const mail = await ctx.fns.pipedrive.api({ path: `/mailbox/mailMessages/${opts.id}`, params: { include_body: 1 } });
    const body = String(mail?.body ?? mail?.body_plain ?? "").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
    return { id: mail.id, subject: mail.subject, from: mail.from, to: mail.to, cc: mail.cc, date: mail.message_time, body };
}
