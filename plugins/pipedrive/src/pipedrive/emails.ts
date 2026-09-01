/** Reads email messages attached to one Pipedrive deal or person, newest first. */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Deal ID whose attached mail is read; mutually exclusive with person. */ deal?: number;
        /** Person ID whose attached mail is read; mutually exclusive with deal. */ person?: number;
        /** Maximum messages. @default 200 @minimum 1 @maximum 500 */ limit?: number;
    },
): Promise<any[]> {
    if ((opts.deal == null) === (opts.person == null)) throw new Error("pipedrive.emails: pass exactly one of deal or person");
    const base = opts.deal != null ? `/deals/${opts.deal}` : `/persons/${opts.person}`;
    const limit = Math.max(1, Math.min(opts.limit ?? 200, 500));
    const output: any[] = [];
    for (let start = 0; output.length < limit; start += 50) {
        const page = await ctx.fns.pipedrive.api({ path: `${base}/mailMessages`, params: { start, limit: 50 } });
        const items = (page ?? []).map((row: any) => row.data ?? row);
        output.push(...items);
        if (items.length < 50) break;
    }
    return output.slice(0, limit).map((mail: any) => ({
        id: mail.id,
        subject: mail.subject,
        from: (mail.from ?? []).map((entry: any) => entry.email_address).join(", "),
        to: (mail.to ?? []).map((entry: any) => entry.email_address).join(", "),
        cc: (mail.cc ?? []).map((entry: any) => entry.email_address).join(", "),
        date: mail.message_time,
        snippet: mail.snippet,
        has_body: Boolean(mail.body_url),
    }));
}
