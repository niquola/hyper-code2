function parseJson(text: string): any {
    return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
}

function compactMessage(message: any, index: number) {
    return {
        index,
        role: message.role,
        content: typeof message.content === "string" ? message.content : JSON.stringify(message.content ?? ""),
        ...(message.tool_calls?.length ? { toolCalls: message.tool_calls.map((x: any) => ({ name: x.name, args: x.args })) } : {}),
    };
}

export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { agent: types.agent.Agent; force?: boolean; minMessages?: number; tailUserTurns?: number },
): Promise<{ started: boolean; reason?: string }> {
    const parent = opts.agent;
    if (parent.scratchpad?.delegateTask?.taskKind) return { started: false, reason: "delegated child" };
    const running: Set<string> = ((ctx.state as any).sleepRuns ??= new Set());
    if (((ctx.state as any).reflectionRuns as Set<string> | undefined)?.has(parent.id)) return { started: false, reason: "reflection running" };
    if (running.has(parent.id)) return { started: false, reason: "already sleeping" };

    const messages = await ctx.fns.session.getFullMessages({ id: parent.id });
    const sourceOffset = messages.length;
    const sleep = ctx.fns.agent.normalizeSleepContext({ sleepContext: parent.sleepContext });
    const baseGeneration = sleep
        ? ctx.fns.agent.getSleepGeneration({ sleepContext: sleep, kind: sleep.activeRevision != null ? "active" : "latest" })
        : null;
    if (!opts.force && sourceOffset < Math.max(4, opts.minMessages ?? 20)) return { started: false, reason: "short context" };
    if (!opts.force && Number(baseGeneration?.sourceOffset ?? 0) >= sourceOffset) return { started: false, reason: "already consolidated" };

    const sourceRow = ((await ctx.fns.procs.db.select({ sql: "SELECT updated_at FROM agents WHERE id = ? AND run_state = 'idle'", params: [parent.id] })) as any[])[0];
    if (!sourceRow) return { started: false, reason: "agent busy" };
    const sourceUpdatedAt = Number(sourceRow.updated_at);
    running.add(parent.id);

    void (async () => {
        let child: types.agent.Agent | null = null;
        try {
            child = await ctx.fns.session.fork({ id: parent.id, offset: sourceOffset, title: `${parent.title || parent.id} · sleep` });
            child.scratchpad ??= {};
            child.scratchpad.delegateTask = { taskKind: "sleep", parentId: parent.id };
            await ctx.fns.session.updateScratchpad({ id: child.id, scratchpad: child.scratchpad });

            const priorOffset = Math.max(0, Number(baseGeneration?.sourceOffset ?? 0));
            const input = baseGeneration
                ? { previous: baseGeneration.state, newMessages: messages.slice(priorOffset).map(compactMessage) }
                : { previous: null, messages: messages.map(compactMessage) };
            const system = `Ты консолидируешь историю рабочего агента перед сном. Не продолжай задачу и не отвечай пользователю. Сохрани точные требования пользователя, текущую цель, решения, подтверждённые факты, изменённые файлы и артефакты, тесты и коммиты, значимые ошибки, незавершённые задачи и следующий шаг. Не выдумывай факты. Удаляй болтовню, повторы и подробности завершённых tool-вызовов, но сохраняй их существенный результат. Обнови предыдущую консолидацию новыми сообщениями. Верни только JSON: {situation:string, requirements:string[], decisionsAndFacts:string[], workLog:string[], openWork:string[], mistakesToAvoid:string[], nextStep:string}.`;
            const call = await ctx.fns.agent.llmCall({ agent: child, system, user: JSON.stringify(input), temperature: 0.1 });
            const state = parseJson(call.text);
            for (const key of ["requirements", "decisionsAndFacts", "workLog", "openWork", "mistakesToAvoid"]) {
                if (!Array.isArray(state?.[key])) throw new Error(`invalid sleep state: ${key}`);
                state[key] = state[key].map((x: any) => String(x).trim()).filter(Boolean).slice(0, 30);
            }
            if (!state?.situation || !state?.nextStep) throw new Error("invalid sleep state: situation/nextStep");

            const tailTurns = Math.max(1, Math.min(8, opts.tailUserTurns ?? 3));
            const userIndexes = messages.map((m: any, i: number) => m.role === "user" && !m.excluded_from_cursor ? i : -1).filter((i: number) => i >= 0);
            const tailStart = userIndexes[Math.max(0, userIndexes.length - tailTurns)] ?? Math.max(0, sourceOffset - 8);
            const lines = (title: string, values: any[]) => values.length ? `\n${title}:\n${values.map(x => `- ${x}`).join("\n")}` : "";
            const consolidated = `# Consolidated session\n\n## Situation\n${state.situation}${lines("User requirements", state.requirements)}${lines("Decisions and facts", state.decisionsAndFacts)}${lines("Work log", state.workLog)}${lines("Open work", state.openWork)}${lines("Mistakes to avoid", state.mistakesToAvoid)}\n\n## Next step\n${state.nextStep}`;
            const consolidatedMessage = { role: "user", content: consolidated, message_type: "consolidated_session" };
            await ctx.fns.session.appendMessage({ id: child.id, message: consolidatedMessage });
            const consolidatedAck = { role: "assistant", content: "Understood. I will continue from this consolidated session state.", message_type: "consolidated_ack" };
            await ctx.fns.session.appendMessage({ id: child.id, message: consolidatedAck });
            const revision = Math.max(0, ...(sleep?.generations ?? []).map((x: any) => Number(x.revision ?? 0))) + 1;
            const generation = {
                revision,
                sourceOffset,
                tailStart,
                createdAt: Date.now(),
                state,
                contextAgentId: child.id,
                contextMessages: [consolidatedMessage, consolidatedAck],
            };
            const next = {
                mode: sleep?.mode === "compact" ? "compact" : "full",
                activeRevision: sleep?.activeRevision ?? null,
                draftRevision: revision,
                generations: [...(sleep?.generations ?? []), generation].slice(-5),
            };
            const currentCount = (await ctx.fns.session.getFullMessages({ id: parent.id })).length;
            if (currentCount !== sourceOffset) return;
            const updated = await ctx.fns.procs.db.run({
                sql: "UPDATE agents SET sleep_context = ?::jsonb, updated_at = ? WHERE id = ? AND updated_at = ? AND run_state = 'idle'",
                params: [JSON.stringify(next), generation.createdAt, parent.id, sourceUpdatedAt],
            });
            if (updated.changes > 0) parent.sleepContext = next;
        } catch (error) {
            console.error(`sleep for ${parent.id} failed:`, error);
        } finally {
            if (child) await ctx.fns.session.archive({ id: child.id }).catch(() => undefined);
            running.delete(parent.id);
        }
    })();
    return { started: true };
}
