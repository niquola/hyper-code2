/**
 * Creates preparation chats for today's calendar meetings.
 *
 * Reads today's primary calendar for one Google account and creates a research agent only when no active chat is already tagged with that event identifier.
 * @param opts.account Google account and primary calendar owner. @default niquola@health-samurai.io
 * @param opts.dryRun Report events without creating preparation chats. @default false
 * @param opts.now Timestamp used for deterministic date filtering.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Google account and primary calendar owner. @default niquola@health-samurai.io */
        account?: string;
        /** Report events without creating preparation chats. @default false */
        dryRun?: boolean;
        /** Timestamp used for deterministic date filtering. */
        now?: number;
    },
): Promise<{ account: string; events: number; eligible: number; created: Array<{ eventId: string; title: string; agentId: string }>; skipped: Array<{ eventId: string; title: string; reason: string }> }> {
    const account = String(opts.account ?? "niquola@health-samurai.io").trim();
    const now = Math.floor(opts.now ?? Date.now());
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
    const events: any[] = await ctx.fns.gcal.events({ account, calendarId: "primary", from: dayStart.toISOString(), to: dayEnd.toISOString(), max: 100 });
    const eligible = events.filter((event: any) => event?.id && !event.allDay && event.status !== "cancelled" && event.responseStatus !== "declined" && new Date(event.end ?? event.start).getTime() > now);
    const created: Array<{ eventId: string; title: string; agentId: string }> = [];
    const skipped: Array<{ eventId: string; title: string; reason: string }> = [];
    for (const event of eligible) {
        const eventId = String(event.id), title = String(event.summary ?? "Untitled meeting");
        const eventKey = account + ":" + eventId;
        const existing = await ctx.fns.procs.db.select({ sql: "SELECT id FROM agents WHERE (scratchpad::jsonb)->>'calendarEventKey' = ? AND archived_at IS NULL LIMIT 1", params: [eventKey] });
        if (existing[0]) { skipped.push({ eventId, title, reason: "chat exists: " + existing[0].id }); continue; }
        if (opts.dryRun) { skipped.push({ eventId, title, reason: "dry run" }); continue; }
        const model = await ctx.fns.settings.modelDefault({});
        const agent = await ctx.fns.agent.start({ model, title: ("Prepare: " + title).slice(0, 120), workspaceDir: String(ctx.env.HOME ?? "") + "/calendar", systemPrompt: "You prepare an evidence-based briefing for one meeting. Gather maximum relevant context using read-only searches across Gmail, Zulip, Google Drive/docs, local files, repositories, and the web. Use Google account " + account + ". Never send messages, modify calendar data, or contact participants. Separate facts from inference, cite sources and dates, and avoid unrelated private information. Save the final Markdown briefing in the workspace." });
        agent.scratchpad = { ...(agent.scratchpad ?? {}), calendarEventKey: eventKey, calendarEventId: eventId, calendarAccount: account, calendarStart: event.start };
        await ctx.fns.session.save({ agent });
        const prompt = ["Prepare me maximally for this meeting.", "", "Calendar event:", JSON.stringify(event, null, 2), "", "Research the purpose, agenda, participants, recent communications, prior decisions, unresolved questions, risks, dependencies, and useful talking points. Search Gmail, Zulip, Drive/docs, prior briefs, repositories and the web as relevant. Open and read the most relevant sources, not just search snippets. Produce a concise cited Markdown briefing in ~/calendar and include suggested questions and actions. Do not send or modify anything."].join("\n");
        await ctx.fns.session.appendUserMessage({ id: agent.id, text: prompt });
        await ctx.fns.session.syncAgentState({ agent });
        await ctx.fns.procs.db.run({ sql: "UPDATE agents SET next_run_at = ?, updated_at = ? WHERE id = ?", params: [Date.now(), Date.now(), agent.id] });
        ctx.fns.agent.wakeWorker({});
        created.push({ eventId, title, agentId: agent.id });
    }
    return { account, events: events.length, eligible: eligible.length, created, skipped };
}
