// Read direct messages (1:1 and group DMs) via narrow is:dm.
//   ctx.fns.zulip.dms({ instance: "fhir", max: 20 })                        // recent DMs, any conversation
//   ctx.fns.zulip.dms({ with: ["Josh Mandel", "Gino Canessa"], max: 30 })   // only threads including ALL named people
//   ctx.fns.zulip.dms({ with: ["Josh Mandel"], group: false })              // only the 1:1 thread
// → [{ id, date, sender, to: string[], content }] oldest→newest
function stripHtml(html: string): string {
    return String(html ?? "")
        .replace(/<[^>]*>/g, "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
}

export default async function (ctx: Context, _session: Session | null, opts?: {
    with?: string[];      // full names; thread must include ALL of them
    group?: boolean;      // true → only group DMs (3+ people), false → only 1:1, omit → both
    max?: number;         // messages to return after filtering (default 30)
    fetch?: number;       // how many raw DMs to scan (default 200)
    instance?: string;
}) {
    const r = await ctx.fns.zulip.api({
        instance: opts?.instance,
        path: "/messages",
        query: {
            anchor: "newest",
            num_before: String(opts?.fetch ?? 200),
            num_after: "0",
            narrow: JSON.stringify([{ operator: "is", operand: "dm" }]),
        },
    });
    let msgs = (r.messages ?? []) as any[];

    if (opts?.with?.length) {
        msgs = msgs.filter(m => {
            const names = (m.display_recipient ?? []).map((u: any) => u.full_name);
            return opts.with!.every(w => names.some((n: string) => n.includes(w)));
        });
    }
    if (opts?.group !== undefined) {
        // display_recipient includes self → 1:1 has 2 entries, group has 3+
        msgs = msgs.filter(m => (m.display_recipient?.length ?? 0) >= 3 === opts.group);
    }

    return msgs.slice(-(opts?.max ?? 30)).map(m => ({
        id: m.id,
        date: new Date(m.timestamp * 1000).toISOString().slice(0, 16),
        sender: m.sender_full_name,
        to: (m.display_recipient ?? []).map((u: any) => u.full_name).filter((n: string) => n !== m.sender_full_name),
        content: stripHtml(m.content).slice(0, 1000),
    }));
}
