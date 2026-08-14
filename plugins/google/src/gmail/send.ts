// Send a plain-text email, optionally with attachments and CC/BCC.
// ctx.fns.gmail.send({ to, subject, body, cc?, bcc?, attachments?: ["/path/file.pdf"], threadId?, account? })
// `to`/`cc`/`bcc` may be a comma-separated string or an array. → { id, threadId }
/**
 * Send an email through Gmail.
 *
 * @param opts - Options for the operation.
 * @param opts.to - Recipient address or addresses.
 * @param opts.subject - Message subject.
 * @param opts.body - Request body or message body, as applicable.
 * @param opts.cc - Carbon-copy recipient address or addresses.
 * @param opts.bcc - Blind-carbon-copy recipient address or addresses.
 * @param opts.attachments - Local file paths to attach.
 * @param opts.threadId - Gmail thread identifier.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        to: string | string[];
        subject: string;
        body: string;
        cc?: string | string[];
        bcc?: string | string[];
        attachments?: string[];
        threadId?: string;
        account?: string;
    },
) {
    const addr = (v?: string | string[]) => (Array.isArray(v) ? v.join(", ") : v);
    const files = opts.attachments ?? [];

    // Recipient headers, only the ones present. Kept out of the body/MIME arrays
    // so we never risk filtering blank separator lines.
    const recip: string[] = [`To: ${addr(opts.to)}`];
    if (opts.cc) recip.push(`Cc: ${addr(opts.cc)}`);
    if (opts.bcc) recip.push(`Bcc: ${addr(opts.bcc)}`);

    let raw: string;
    if (files.length === 0) {
        // simple text/plain message
        const lines = [
            ...recip,
            `Subject: ${opts.subject}`,
            "MIME-Version: 1.0",
            "Content-Type: text/plain; charset=utf-8",
            "", // blank line separates headers from body — MUST NOT be filtered out
            opts.body,
        ];
        raw = Buffer.from(lines.join("\r\n")).toString("base64url");
    } else {
        // multipart/mixed with attachments
        const boundary = "uniskill_" + files.length + "_" + opts.subject.length + "_bnd";
        const lines: string[] = [
            ...recip,
            `Subject: ${opts.subject}`,
            "MIME-Version: 1.0",
            `Content-Type: multipart/mixed; boundary="${boundary}"`,
            "", // end of top-level headers
            `--${boundary}`,
            "Content-Type: text/plain; charset=utf-8",
            "Content-Transfer-Encoding: 8bit",
            "", // end of part headers
            opts.body,
            "", // blank line before next boundary
        ];
        for (const path of files) {
            const data = await Bun.file(path).arrayBuffer();
            const b64 = Buffer.from(data).toString("base64").replace(/(.{76})/g, "$1\r\n");
            const name = path.split("/").pop() || "attachment";
            const ext = name.split(".").pop()?.toLowerCase();
            const mime =
                ext === "pdf" ? "application/pdf" :
                ext === "png" ? "image/png" :
                ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
                ext === "txt" ? "text/plain" :
                "application/octet-stream";
            lines.push(
                `--${boundary}`,
                `Content-Type: ${mime}; name="${name}"`,
                "Content-Transfer-Encoding: base64",
                `Content-Disposition: attachment; filename="${name}"`,
                "",
                b64,
                "",
            );
        }
        lines.push(`--${boundary}--`);
        raw = Buffer.from(lines.join("\r\n")).toString("base64url");
    }

    const res = await ctx.fns.gmail.api({
        path: "/messages/send",
        method: "POST",
        account: opts.account,
        body: opts.threadId ? { raw, threadId: opts.threadId } : { raw },
    });
    return { id: res.id, threadId: res.threadId };
}
