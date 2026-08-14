function parseJson(text: string): any {
    const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    return JSON.parse(trimmed);
}

/**
 * Schedules a background reflection over an agent's recent conversation.
 *
 * A temporary child agent updates structured activity, tasks, satisfaction,
 * mistakes, and a short actionable nudge in `agents.reflection`.
 *
 * @see docs/reflection.md
  * @param opts.agent Agent whose state is read or updated.
 * @param opts.every Optional cadence override.
*/

export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {

        /** Agent whose conversation should be reflected. */
        agent: types.agent.Agent;

        /** Minimum number of new user messages. @default 3 @minimum 1 */
        every?: number;
    },
): Promise<{ started: boolean; reason?: string }> {
    const parent = opts.agent;
    const every = Math.max(1, opts.every ?? 3);
    if (parent.reflectionEnabled === false) return { started: false, reason: "disabled" };
    if (parent.scratchpad?.delegateTask?.taskKind === "reflection") return { started: false, reason: "reflection child" };

    const row = ((await ctx.fns.procs.db.select({
        sql: `SELECT reflection,
                     (SELECT COUNT(*) FROM messages WHERE agent_id = agents.id AND role = 'user' AND excluded_from_cursor = 0) AS user_count
                FROM agents WHERE id = ?`,
        params: [parent.id],
    })) as any[])[0];
    if (!row) return { started: false, reason: "agent missing" };

    const previous = row.reflection == null ? null : (typeof row.reflection === "string" ? JSON.parse(row.reflection) : row.reflection);
    const userCount = Number(row.user_count ?? 0);
    const reflectedUserCount = Number(previous?.reflectedUserCount ?? 0);
    if (userCount - reflectedUserCount < every) return { started: false, reason: "threshold" };

    const running: Set<string> = ((ctx.state as any).reflectionRuns ??= new Set());
    if (running.has(parent.id)) return { started: false, reason: "already running" };
    running.add(parent.id);

    void (async () => {
        let child: types.agent.Agent | null = null;
        try {
            const messages = await ctx.fns.session.getFullMessages({ id: parent.id });
            const snapshotOffset = messages.length;
            child = await ctx.fns.session.fork({ id: parent.id, offset: snapshotOffset, title: `${parent.title || parent.id} · reflection` });
            child.scratchpad ??= {};
            child.scratchpad.delegateTask = { taskKind: "reflection", parentId: parent.id };
            await ctx.fns.session.updateScratchpad({ id: child.id, scratchpad: child.scratchpad });

            const from = Math.max(0, Number(previous?.reflectedThrough ?? 0));
            const segment = messages.slice(from).map((m: any, i: number) => ({
                index: from + i,
                role: m.role,
                content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
            }));
            const system = `Ты — фоновый рефлексирующий агент. Обнови рефлексию основного агента по новому фрагменту диалога. Не отвечай пользователю и не продолжай задачу. Определи: что сейчас делается, текущий этап и следующий шаг; конкретные задачи; удовлетворённость пользователя только по явным сигналам (отсутствие критики не означает удовлетворённость); значимые ошибки агента, их влияние, статус и урок. Не считай обычное исследование вариантов ошибкой. Рекурсивно обновляй tasks: сохраняй незавершённые, объединяй дубли, меняй статусы по фактам и оставляй не более 5 последних done. Также создай reflectionNudge — одну короткую практическую инструкцию основному агенту на ближайшие ходы, только если она поможет избежать наблюдаемой ошибки или лучше продолжить текущую работу. Это не пересказ цели и не общая банальность. Если полезной инструкции нет, верни null. Не переопределяй явные инструкции пользователя. Сохраняй актуальные прежние выводы и удаляй устаревшие. Верни только JSON с полями activity {goal,currentStep,status: exploring|planning|executing|verifying|blocked,nextStep}, tasks [{title,status: todo|doing|blocked|done,nextStep}], userSatisfaction {level: unknown|dissatisfied|mixed|satisfied,trend: unknown|declining|stable|improving,confidence,reasons}, mistakes [{description,impact,status: unresolved|corrected|accepted,lesson}], reflectionNudge: null | {text,reason,expiresAfterTurns: 1..9}.`;
            const call = await ctx.fns.agent.llmCall({
                agent: child,
                system,
                user: `Предыдущая рефлексия:\n${JSON.stringify(previous?.state ?? null)}\n\nНовый фрагмент диалога:\n${JSON.stringify(segment)}`,
                temperature: 0.2,
            });
            const state = parseJson(call.text);
            if (!state?.activity || !Array.isArray(state?.tasks) || !state?.userSatisfaction || !Array.isArray(state?.mistakes)) throw new Error("invalid reflection shape");
            const openTasks = state.tasks.filter((task: any) => task?.status !== "done");
            const doneTasks = state.tasks.filter((task: any) => task?.status === "done").slice(-5);
            state.tasks = [...openTasks, ...doneTasks];
            // A model asked for a list of reasons happily answers with one
            // sentence instead. Store the shape the readers were promised, so a
            // single loose answer cannot break the page that renders it.
            const reasons = state.userSatisfaction.reasons;
            state.userSatisfaction.reasons = Array.isArray(reasons)
                ? reasons.map((x: any) => String(x)).filter(Boolean)
                : typeof reasons === "string" && reasons.trim() ? [reasons.trim()] : [];
            if (state.reflectionNudge && typeof state.reflectionNudge === "object") {
                const text = String(state.reflectionNudge.text ?? "").trim().slice(0, 500);
                const reason = String(state.reflectionNudge.reason ?? "").trim().slice(0, 500);
                const expiresAfterTurns = Math.max(1, Math.min(9, Math.floor(Number(state.reflectionNudge.expiresAfterTurns ?? 3) || 3)));
                state.reflectionNudge = text ? { text, reason, expiresAfterTurns, createdAtUserCount: userCount } : null;
            } else state.reflectionNudge = null;
            const next = {
                revision: Number(previous?.revision ?? 0) + 1,
                reflectedThrough: snapshotOffset,
                reflectedUserCount: userCount,
                updatedAt: Date.now(),
                state,
            };
            const updated = await ctx.fns.procs.db.run({
                sql: `UPDATE agents SET reflection = ?::jsonb, updated_at = ?
                       WHERE id = ? AND COALESCE((reflection->>'revision')::int, 0) = ?`,
                params: [JSON.stringify(next), next.updatedAt, parent.id, Number(previous?.revision ?? 0)],
            });
            if (updated.changes > 0) {
                parent.reflection = next;
                ctx.fns.procs.events.refresh({ topic: `agent:${parent.id}`, reason: "reflection" });
            }
                ctx.fns.events.refreshAgentMeta({ agentId: parent.id, reason: "reflection" });
        } catch (error) {
            console.error(`reflection for ${parent.id} failed:`, error);
        } finally {
            if (child) await ctx.fns.session.archive({ id: child.id }).catch(() => undefined);
            running.delete(parent.id);
        }
    })();

    return { started: true };
}
