/**
 * Wakes the calendar master agent to inspect today's events.
 *
 * Finds or creates one persistent calendar master chat for an account and queues an instruction to create missing event preparation agents through calendar.prepareToday.
 * @param opts.account Google account and primary calendar owner. @default niquola@health-samurai.io
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Google account and primary calendar owner. @default niquola@health-samurai.io */
        account?: string;
    },
): Promise<{ agentId: string; created: boolean; account: string }> {
    const account = String(opts.account ?? "niquola@health-samurai.io").trim();
    const workspaceDir = String(ctx.env.HOME ?? "") + "/calendar";
    const key = "calendar-master:" + account;
    const rows = await ctx.fns.procs.db.select({ sql: "SELECT value FROM kv WHERE key = ?", params: [key] });
    let master: any = null;
    const id = rows[0]?.value ? String(rows[0].value) : "";
    if (id) master = (ctx.state as any).agent?.[id] ?? await ctx.fns.session.load({ id });
    let created = false;
    if (!master) {
        const model = await ctx.fns.settings.modelDefault({});
        master = await ctx.fns.agent.start({ model, title: "Calendar master", workspaceDir, systemPrompt: "You are the calendar master for " + account + ". When the scheduled instruction arrives, inspect today's calendar and create one dedicated preparation agent for every upcoming meeting that does not already have a chat. Use calendar.prepareToday for deterministic event-level deduplication. Do not prepare meetings yourself and do not send or modify external data. Summarize only what was newly created or failed." });
        await ctx.fns.files.mkdir({ path: workspaceDir });
        master.scratchpad = { ...(master.scratchpad ?? {}), calendarMasterAccount: account };
        await ctx.fns.session.save({ agent: master });
        await ctx.fns.procs.db.run({ sql: "INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", params: [key, master.id] });
        created = true;
    }
    const text = "Scheduled calendar scan: inspect what is new in today's calendar for " + account + ". Call calendar.prepareToday({ account: " + JSON.stringify(account) + " }). It creates missing meeting-preparation chats and deduplicates by calendar event id. Report created and skipped meetings concisely.";
    await ctx.fns.session.appendUserMessage({ id: master.id, text });
    await ctx.fns.session.syncAgentState({ agent: master });
    await ctx.fns.procs.db.run({ sql: "UPDATE agents SET next_run_at = GREATEST(COALESCE(next_run_at, 0), ?), updated_at = ? WHERE id = ?", params: [Date.now(), Date.now(), master.id] });
    ctx.fns.agent.wakeWorker({});
    return { agentId: master.id, created, account };
}
