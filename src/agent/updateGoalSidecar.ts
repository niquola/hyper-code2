/**
 * Extracts a display-only goal list from a chat message in an isolated hidden fork
 *
 * Forks the parent transcript into a hidden child (so the provider prompt cache of the parent is reused), runs one agent turn that asks the model to reconcile the previously observed goals with the whole dialogue and to hand the result back through `ctx.fns.agent.setObservedGoals` from eval, then archives the fork. The parent's `scratchpad.goalSidecar` is written by that call, never by parsing prose. Use after durable user-message ingestion; it never changes agent.goal, scheduling, plans, or the main execution transcript.
 * @param opts.agent Live parent chat agent whose goal preview is updated.
 * @param opts.messageIdx Durable index of the user message that triggered extraction. @minimum 0
 * @param opts.userMessage Plain text of the triggering user message.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Live parent chat agent whose goal preview is updated. */
        agent: types.agent.Agent;
        /** Durable index of the user message that triggered extraction. @minimum 0 */
        messageIdx: number;
        /** Plain text of the triggering user message. */
        userMessage: string;
    },
): Promise<{ goals: Array<{ id: string; statement: string; verification: string; status: "candidate" | "active" | "completed" | "abandoned"; sourceMessageIdx: number }>; sidecarId: string }> {
    const { agent } = opts;
    const userMessage = String(opts.userMessage ?? "").trim().slice(0, 20000);
    const previous = Array.isArray(agent.scratchpad?.goalSidecar?.goals) ? agent.scratchpad.goalSidecar.goals.slice(0, 20) : [];
    if (!userMessage) return { goals: previous, sidecarId: "" };
    // Full-transcript fork: the child inherits model, tools and system prompt,
    // so its bootstrap and history are byte-identical to the parent's and the
    // provider serves them from cache. Only the one instruction below is new.
    const sidecar = await ctx.fns.session.fork({ id: agent.id, title: `Goal sidecar · ${agent.id}`, visibility: "hidden" });
    // A compacted parent sends its active generation, not the raw history;
    // the observer must see the same bounded context, or it re-sends the
    // whole transcript the parent itself no longer fits.
    sidecar.sleepContext = agent.sleepContext ?? null;
    sidecar.scratchpad = { goalSidecarFor: agent.id, sourceMessageIdx: opts.messageIdx };
    await ctx.fns.session.save({ agent: sidecar });
    const instruction = [
      "SIDECAR TASK — goal observation only. You are a hidden fork of this conversation; the real agent keeps working separately. Do not continue the user's work, do not edit files, do not answer the user.",
      "Reconcile the previously observed goal list with the whole dialogue above, especially the latest user message.",
      "A goal is a desired outcome, not a question, topic, conversational instruction, plan step, or implementation detail.",
      "Keep stable ids for unchanged goals. Refine wording when the user clarifies it. Mark replaced/rejected goals abandoned; explicitly achieved goals completed. Add a candidate only when intent is uncertain.",
      "For every goal, formulate verification as one concise observable check answering: how will we know this goal is achieved? Prefer concrete evidence or an acceptance scenario; do not merely repeat the statement.",
      "Do not infer goals from assistant claims alone. Write statements in the user's language.",
      `Previously observed goals: ${JSON.stringify(previous)}`,
      `Latest user message (idx ${opts.messageIdx}): ${JSON.stringify(userMessage)}`,
      "Respond with exactly ONE eval tool call and nothing else — no other tools, no prose:",
      "await ctx.fns.agent.setObservedGoals({ goals: [{ id, statement, verification, status: 'candidate'|'active'|'completed'|'abandoned', sourceMessageIdx }] })",
    ].join("\n\n");
    // Whatever happened inside the run, a ready preview written by THIS
    // sidecar for THIS message is the truth (it may have been followed by a
    // failing extra turn); anything else is recorded as an error without
    // touching another sidecar's newer or equal-index result.
    const finish = async (error?: string) => {
      const updated = await ctx.fns.session.mutateScratchpad({ id: agent.id, mutate: (scratchpad: Record<string, any>, now: number) => {
        const current = scratchpad.goalSidecar ?? {};
        const mine = current.sidecarId === sidecar.id && Number(current.sourceMessageIdx) === opts.messageIdx;
        if (mine && current.status === "ready") return { status: "ready" };
        if (Number(current.sourceMessageIdx ?? -1) > opts.messageIdx) return { status: "stale" };
        if (Number(current.sourceMessageIdx ?? -1) === opts.messageIdx && !mine && current.status === "ready") return { status: "duplicate" };
        scratchpad.goalSidecar = { ...current, goals: Array.isArray(current.goals) ? current.goals : previous, status: "error", error: String(error ?? "sidecar did not call agent.setObservedGoals").slice(0, 500), updatedAt: now, sourceMessageIdx: opts.messageIdx, sidecarId: sidecar.id };
        return { status: "error" };
      } });
      // Merge, never replace: a live parent run keeps transient keys in memory.
      agent.scratchpad = { ...(agent.scratchpad ?? {}), goalSidecar: updated.scratchpad.goalSidecar };
      await ctx.fns.session.archive({ id: sidecar.id }).catch(() => undefined);
      ctx.fns.events.refreshAgentMeta({ agentId: agent.id, section: "goal", reason: (updated.result as any)?.status === "error" ? "goal-sidecar-error" : "goal-sidecar" });
    };
    // Bound a misbehaving observer: one provider turn plus the eval is all it
    // needs; agent.run itself has only the 300-cycle cap and no clock.
    const timeoutMs = Number(await ctx.fns.settings.getNumber({ module: "agent", key: "goalSidecarTimeoutMs", scopeType: "global" }).catch(() => undefined)) || 120_000;
    const timer = setTimeout(() => sidecar.abortController?.abort(new Error(`goal sidecar exceeded ${timeoutMs}ms`)), timeoutMs);
    try {
      await ctx.fns.agent.run({ agent: sidecar, userText: instruction });
      await finish();
    } catch (error: any) {
      await finish(String(error?.message ?? error));
    } finally {
      clearTimeout(timer);
    }
    const goals = Array.isArray(agent.scratchpad?.goalSidecar?.goals) ? agent.scratchpad.goalSidecar.goals : previous;
    return { goals, sidecarId: sidecar.id };
}
