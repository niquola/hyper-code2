/**
 * Extracts a display-only goal list from a chat message in an isolated hidden fork
 *
 * Creates a hidden fork at the triggering user message, asks a non-tool LLM sidecar to reconcile the prior observed goals with recent dialogue, persists the resulting preview in the parent scratchpad, and refreshes the Goal meta section. Use after durable user-message ingestion; it never changes agent.goal, scheduling, plans, or the main execution transcript.
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
    if (!userMessage) return { goals: Array.isArray(agent.scratchpad?.goalSidecar?.goals) ? agent.scratchpad.goalSidecar.goals : [], sidecarId: "" };
    const previous = Array.isArray(agent.scratchpad?.goalSidecar?.goals) ? agent.scratchpad.goalSidecar.goals.slice(0, 20) : [];
    const sidecar = await ctx.fns.session.fork({ id: agent.id, title: `Goal sidecar · ${agent.id}`, visibility: "hidden" });
    sidecar.systemPrompt = "You are a goal-observation sidecar. You only identify user goals; you never execute them or influence the parent agent. Return strict JSON.";
    sidecar.scratchpad = { goalSidecarFor: agent.id, sourceMessageIdx: opts.messageIdx };
    await ctx.fns.session.save({ agent: sidecar });
    const full = await ctx.fns.session.getFullMessages({ id: agent.id });
    const recent = full.slice(-24).map((message: any) => ({ role: message.role, content: typeof message.content === "string" ? message.content.slice(0, 4000) : message.content }));
    const schema = { type: "json_schema", json_schema: { name: "goal_sidecar", strict: true, schema: { type: "object", additionalProperties: false, properties: { goals: { type: "array", maxItems: 20, items: { type: "object", additionalProperties: false, properties: { id: { type: "string" }, statement: { type: "string" }, verification: { type: "string" }, status: { type: "string", enum: ["candidate", "active", "completed", "abandoned"] }, sourceMessageIdx: { type: "integer" } }, required: ["id", "statement", "verification", "status", "sourceMessageIdx"] } } }, required: ["goals"] } } };
    const prompt = [
      "Reconcile the old observed goal list with the latest user message and recent dialogue.",
      "A goal is a desired outcome, not a question, topic, conversational instruction, plan step, or implementation detail.",
      "Keep stable ids for unchanged goals. Refine wording when the user clarifies it. Mark replaced/rejected goals abandoned; explicit achieved goals completed. Add a candidate only when intent is uncertain.",
      "For every goal, formulate verification as one concise observable check answering: how will we know this goal is achieved? Prefer concrete evidence or an acceptance scenario; do not merely repeat the statement.",
      "Do not infer goals from assistant claims alone. Return only the schema JSON.",
      JSON.stringify({ oldGoals: previous, latest: { messageIdx: opts.messageIdx, text: userMessage }, recentDialogue: recent }),
    ].join("\n\n");
    try {
      const result = await ctx.fns.llm.call({ model: agent.model, sessionId: sidecar.id, system: sidecar.systemPrompt, user: prompt, temperature: 0, max_tokens: 1800, response_format: schema });
      let parsed: any;
      try { parsed = JSON.parse(String(result.text).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")); } catch { parsed = { goals: previous }; }
      const allowed = new Set(["candidate", "active", "completed", "abandoned"]);
      const goals = (Array.isArray(parsed?.goals) ? parsed.goals : previous).slice(0, 20).map((goal: any, index: number) => ({
        id: String(goal?.id || previous[index]?.id || `g${index + 1}`).slice(0, 80),
        statement: String(goal?.statement ?? "").trim().slice(0, 1000),
        verification: String(goal?.verification ?? previous[index]?.verification ?? "").trim().slice(0, 1000),
        status: (allowed.has(String(goal?.status)) ? String(goal.status) : "candidate") as "candidate" | "active" | "completed" | "abandoned",
        sourceMessageIdx: Math.max(0, Math.floor(Number(goal?.sourceMessageIdx ?? opts.messageIdx) || opts.messageIdx)),
      })).filter((goal: any) => goal.statement);
      await ctx.fns.session.appendMessage({ id: sidecar.id, message: { role: "user", content: prompt, excluded_from_cursor: true, message_type: "goal_sidecar_input" } });
      await ctx.fns.session.appendMessage({ id: sidecar.id, message: { role: "assistant", content: JSON.stringify({ goals }), message_type: "goal_sidecar_result" } });
      const updated = await ctx.fns.session.mutateScratchpad({ id: agent.id, mutate: (scratchpad: Record<string, any>, now: number) => {
        if (Number(scratchpad.goalSidecar?.sourceMessageIdx ?? -1) > opts.messageIdx) return;
        scratchpad.goalSidecar = { goals, status: "ready", updatedAt: now, sourceMessageIdx: opts.messageIdx, sidecarId: sidecar.id };
      } });
      agent.scratchpad = updated.scratchpad;
      await ctx.fns.session.archive({ id: sidecar.id });
      ctx.fns.events.refreshAgentMeta({ agentId: agent.id, section: "goal", reason: "goal-sidecar" });
      return { goals, sidecarId: sidecar.id };
    } catch (error: any) {
      const updated = await ctx.fns.session.mutateScratchpad({ id: agent.id, mutate: (scratchpad: Record<string, any>, now: number) => {
        if (Number(scratchpad.goalSidecar?.sourceMessageIdx ?? -1) > opts.messageIdx) return;
        scratchpad.goalSidecar = { ...(scratchpad.goalSidecar ?? {}), goals: previous, status: "error", error: String(error?.message ?? error).slice(0, 500), updatedAt: now, sourceMessageIdx: opts.messageIdx, sidecarId: sidecar.id };
      } });
      agent.scratchpad = updated.scratchpad;
      await ctx.fns.session.archive({ id: sidecar.id }).catch(() => undefined);
      ctx.fns.events.refreshAgentMeta({ agentId: agent.id, section: "goal", reason: "goal-sidecar-error" });
      return { goals: previous, sidecarId: sidecar.id };
    }
}
