/**
 * Read / search messages via a Zulip narrow. Builds the narrow from the given
 * filters, fetches /messages, and maps each row to a flat shape with HTML
 * stripped from content.
 *   ctx.fns.zulip.messages({ channel: "implementers", topic: "US Core", instance: "fhir" })
 *   ctx.fns.zulip.messages({ query: "FHIR R5", channel: "implementers", instance: "fhir" })
 *   ctx.fns.zulip.messages({ unread: true, channel: "implementers", instance: "fhir" })
 * → [{ id, sender, email, content, topic, channel, timestamp, date }]
 *
 * Filters (all optional): channel, topic, sender (email), mentions (display name),
 * query (full-text), unread (only unread). With unread:true the anchor is "oldest"
 * and we page forward; otherwise anchor is "newest" and we page back (most recent).
 */
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

/**
 * Lists Zulip messages matching a narrow.
 *
 * @param ctx Runtime context.
 * @param session Active session, when available.
 * @param [opts] Operation options.
 * @returns The operation result.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts?: {
        /** Zulip channel name. */
        channel?: string;
        /** Zulip topic name. */
        topic?: string;
        /** Sender filter. */
        sender?: string;
        /** Mention filter. */
        mentions?: string;
        /** Search query. */
        query?: string;
        /** Whether to restrict results to unread messages. */
        unread?: boolean;
        /** Maximum number of results to return. */
        limit?: number;
        /** Configured Zulip instance name. */
        instance?: string;
    },
) {
    const o = opts ?? {};
    const narrow: { operator: string; operand: string }[] = [];
    if (o.channel) narrow.push({ operator: "channel", operand: o.channel });
    if (o.topic) narrow.push({ operator: "topic", operand: o.topic });
    if (o.sender) narrow.push({ operator: "sender", operand: o.sender });
    if (o.mentions) narrow.push({ operator: "search", operand: `@**${o.mentions}**` });
    if (o.query) narrow.push({ operator: "search", operand: o.query });
    if (o.unread) narrow.push({ operator: "is", operand: "unread" });

    const limit = o.limit ?? 50;
    const query: Record<string, string> = {
        anchor: o.unread ? "oldest" : "newest",
        num_before: o.unread ? "0" : String(limit),
        num_after: o.unread ? String(limit) : "0",
        narrow: JSON.stringify(narrow),
        apply_markdown: "false",
    };

    const data = await ctx.fns.zulip.api({ path: "/messages", query, instance: o.instance });
    return (data.messages || []).map((m: any) => ({
        id: m.id,
        sender: m.sender_full_name,
        email: m.sender_email,
        content: stripHtml(m.content),
        topic: m.subject || "(no topic)",
        channel: typeof m.display_recipient === "string" ? m.display_recipient : "DM",
        timestamp: m.timestamp,
        date: new Date(m.timestamp * 1000).toISOString(),
    }));
}
