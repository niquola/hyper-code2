function parseJson(text: string): any {
    return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
}

export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { agent: types.agent.Agent; candidateAnswer: string },
): Promise<{ status: "achieved" | "continue" | "needs_user" | "blocked"; reason: string; nextStep?: string; evidence?: string[] }> {
    const goal = opts.agent.goal;
    if (!goal?.enabled || !goal?.statement) return { status: "achieved", reason: "goal disabled" };
    const messages = await ctx.fns.session.getFullMessages({ id: opts.agent.id });
    const recent = messages.slice(-30).map((m: any, i: number) => ({ index: messages.length - 30 + i, role: m.role, content: m.content }));
    const system = `Ты проверяешь достижение внешней рабочей цели агента. Не решай задачу. Верни только JSON {status: achieved|continue|needs_user|blocked, reason:string, nextStep?:string, evidence?:string[]}. Оценивай только саму цель и реальные результаты работы. Никогда не требуй в качестве доказательства будущий статус goal-check, карточку achieved, запись собственного решения или завершение самого цикла проверки — это самореферентные служебные артефакты. achieved допустим при конкретных доказательствах результата. continue — если агент может самостоятельно сделать следующий рабочий шаг. needs_user — если нужен ответ/выбор пользователя. blocked — если продолжение невозможно. Слова агента "готово" сами по себе не доказательство.`;
    try {
        const result = await ctx.fns.agent.llmCall({
            agent: opts.agent,
            system,
            user: JSON.stringify({ goal: goal.statement, candidateAnswer: opts.candidateAnswer, recent }),
            temperature: 0,
        });
        const parsed = parseJson(result.text);
        const status = ["achieved", "continue", "needs_user", "blocked"].includes(parsed?.status) ? parsed.status : "blocked";
        return { status, reason: String(parsed?.reason ?? "No reason provided").slice(0, 1000), nextStep: parsed?.nextStep ? String(parsed.nextStep).slice(0, 1000) : undefined, evidence: Array.isArray(parsed?.evidence) ? parsed.evidence.map(String).slice(0, 10) : [] };
    } catch (error: any) {
        return { status: "blocked", reason: `goal checker failed: ${error?.message ?? error}` };
    }
}
