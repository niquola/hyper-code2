// gmail.unsubscribe — unsubscribe from a bulk sender using the message's List-Unsubscribe header.
// Methods, safest first: RFC 8058 one-click (POST https), mailto (send email), or return the https link.
// DRY-RUN BY DEFAULT — pass { apply: true } to actually act (outbound; confirms your address to sender).
//   ctx.fns.gmail.unsubscribe({ account, from: "whova.io" })            // dry-run: show what it would do
//   ctx.fns.gmail.unsubscribe({ account, id: "<msgid>", apply: true })  // do it
function header(hs: any[], name: string): string | undefined {
    return hs?.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value;
}
/**
 * Inspect or apply a sender unsubscribe action.
 *
 * @param opts - Options for the operation.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 * @param opts.id - Resource identifier.
 * @param opts.from - Sender address or filter criterion.
 * @param opts.apply - When true, perform the unsubscribe action rather than only inspecting it.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    account?: string; id?: string; from?: string; apply?: boolean;
}) {
    let id = opts.id;
    if (!id && opts.from) {
        const r = await ctx.fns.gmail.list({ account: opts.account, q: `from:${opts.from}`, max: 1 });
        id = r[0]?.id;
    }
    if (!id) return { error: "no message (pass id or from)" };

    const msg = await ctx.fns.gmail.api({ account: opts.account, path: `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=List-Unsubscribe&metadataHeaders=List-Unsubscribe-Post` });
    const hs = msg.payload?.headers || [];
    const from = header(hs, "From");
    const raw = header(hs, "List-Unsubscribe");
    const oneClick = /one-click/i.test(header(hs, "List-Unsubscribe-Post") || "");
    if (!raw) return { from, method: "none", note: "no List-Unsubscribe header — use a Gmail filter/archive instead" };

    const links = [...raw.matchAll(/<([^>]+)>/g)].map(m => m[1]!);
    const https = links.find(l => /^https?:/i.test(l));
    const mailto = links.find(l => /^mailto:/i.test(l));
    const method = oneClick && https ? "one-click" : mailto ? "mailto" : https ? "link" : "none";

    if (!opts.apply) return { from, method, oneClick, https, mailto, dryRun: true, note: "pass { apply: true } to execute" };

    if (method === "one-click") {
        const res = await fetch(https!, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "List-Unsubscribe=One-Click" });
        return { from, method, status: res.status, ok: res.ok };
    }
    if (method === "mailto") {
        const u = new URL(mailto!);
        const to = u.pathname; const subject = u.searchParams.get("subject") || "unsubscribe";
        await ctx.fns.gmail.send({ account: opts.account, to, subject, body: "unsubscribe" });
        return { from, method, sentTo: to };
    }
    return { from, method: "link", https, note: "no one-click/mailto — open this link manually (or via cdp)" };
}
