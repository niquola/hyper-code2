// Full message with decoded text body. ctx.fns.gmail.get({ id })
/**
 * Get a Gmail message and its decoded content.
 *
 * @param opts - Options for the operation.
 * @param opts.id - Resource identifier.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (ctx: Context, session: Session | null, opts: { id: string; account?: string }) {
    const msg = await ctx.fns.gmail.api({ path: `/messages/${opts.id}?format=full`, account: opts.account });
    const h = msg?.payload?.headers;
    const headerVal = (name: string) => h?.find((x: any) => x.name.toLowerCase() === name.toLowerCase())?.value;
    const decodeBody = (payload: any): string => {
        if (payload.body?.data) return Buffer.from(payload.body.data, "base64url").toString("utf-8");
        for (const mime of ["text/plain", "text/html"]) {
            for (const part of payload.parts ?? []) {
                if (part.mimeType === mime && part.body?.data) return Buffer.from(part.body.data, "base64url").toString("utf-8");
            }
        }
        for (const part of payload.parts ?? []) {
            const nested = decodeBody(part);
            if (nested) return nested;
        }
        return "";
    };
    return {
        id: msg.id, threadId: msg.threadId,
        from: headerVal("From"), to: headerVal("To"),
        subject: headerVal("Subject"), date: headerVal("Date"),
        body: decodeBody(msg.payload), labelIds: msg.labelIds,
    };
}
