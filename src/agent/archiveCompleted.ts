/**
 * Archive completed delegated agents after an inactivity timeout
 *
 * Archives ready delegated children whose agent row has not changed within the retention timeout, leaving their transcripts durable for later unarchive. Use from periodic maintenance or manually to clean completed team members from active lists.
 * @param opts.olderThanMs Minimum inactivity age for a ready delegated child before archival. @default 60000 @minimum 0
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Minimum inactivity age for a ready delegated child before archival. @default 60000 @minimum 0 */
        olderThanMs?: number;
    },
): Promise<{ archived: string[] }> {
    const olderThanMs = Math.max(0, Number(opts.olderThanMs ?? 60000));
    const cutoff = Date.now() - olderThanMs;
    const rows = (await ctx.fns.procs.db.select({ sql: "SELECT id, parent_id, scratchpad, updated_at FROM agents WHERE archived_at IS NULL AND parent_id IS NOT NULL AND updated_at <= ?", params: [cutoff] })) as any[];
    const archived: string[] = [];
    for (const row of rows) {
      const scratchpad = typeof row.scratchpad === "string" ? JSON.parse(row.scratchpad) : (row.scratchpad ?? {});
      if (scratchpad.delegation?.status !== "ready") continue;
      await ctx.fns.session.archive({ id: String(row.id) });
      archived.push(String(row.id));
      ctx.fns.events.refreshAgentMeta({ agentId: String(row.parent_id), section: "team", reason: "team-timeout-archive" });
    }
    return { archived };
}
