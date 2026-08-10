// gmail.labelCreate — create a Gmail label (idempotent: returns existing if same name). LIVE change.
// Nested labels use "/" (e.g. "Junk/Archived"). ctx.fns.gmail.labelCreate({ account, name: "Junk/Archived" })
export default async function (ctx: Context, _session: Session | null, opts: {
    account?: string; name: string; hide?: boolean;    // hide = keep out of message list / label list
}) {
    if (!opts?.name) throw new Error("labelCreate: name required");
    const existing = await ctx.fns.gmail.api({ account: opts.account, path: "/labels" }).catch(() => ({ labels: [] }));
    const found = (existing?.labels ?? []).find((l: any) => l.name === opts.name);
    if (found) return { id: found.id, name: found.name, existed: true };
    const r = await ctx.fns.gmail.api({
        account: opts.account, method: "POST", path: "/labels",
        body: {
            name: opts.name, labelListVisibility: opts.hide ? "labelHide" : "labelShow",
            messageListVisibility: opts.hide ? "hide" : "show",
        },
    });
    return { id: r.id, name: r.name, existed: false };
}
