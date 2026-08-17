/**
 * Changes the durable reasoning effort preference of one agent
 *
 * Validate and persist one agent reasoning effort preference, update the live agent object, record a visible event and refresh the chat. The stored preference is retained across model switches while llm.resolveReasoningEffort computes any model-specific downgrade.
 * @param opts.id Agent identifier.
 * @param opts.effort Requested reasoning preference.
 * @param opts.now Current timestamp in milliseconds, for testing.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Agent identifier. */
        id: string;
        /** Requested reasoning preference. */
        effort: types.llm.ReasoningEffort;
        /** Current timestamp in milliseconds, for testing. */
        now?: number;
    },
): Promise<{ id: string; requested: types.llm.ReasoningEffort; applied: Exclude<types.llm.ReasoningEffort, "auto">; downgraded: boolean }> {
    const allowed: types.llm.ReasoningEffort[] = ["auto", "off", "minimal", "low", "medium", "high", "xhigh"];
    if (!allowed.includes(opts.effort)) throw new Error("invalid reasoning effort");
    const row = ((await ctx.fns.procs.db.select({ sql: "SELECT id, model, reasoning_effort FROM agents WHERE id = ? AND archived_at IS NULL", params: [opts.id] })) as any[])[0];
    if (!row) throw new Error(`agent not found: ${opts.id}`);
    const previous = String(row.reasoning_effort ?? "auto") as types.llm.ReasoningEffort;
    const resolved = await ctx.fns.llm.resolveReasoningEffort({ model: String(row.model), effort: opts.effort });
    if (previous !== opts.effort) {
        await ctx.fns.procs.db.run({ sql: "UPDATE agents SET reasoning_effort = ?, updated_at = ? WHERE id = ?", params: [opts.effort, opts.now ?? Date.now(), opts.id] });
        const live = (ctx.state as any).agent?.[opts.id];
        if (live) live.reasoningEffort = opts.effort;
        await ctx.fns.session.appendEvent({ id: opts.id, event: { type: "reasoning_effort_changed", from: previous, to: opts.effort, applied: resolved.applied } }).catch(() => undefined);
        try { ctx.fns.events.emitAgentsChanged({ agentId: opts.id, reason: "reasoning-effort" }); } catch {}
    }
    return { id: opts.id, requested: opts.effort, applied: resolved.applied, downgraded: resolved.downgraded };
}
