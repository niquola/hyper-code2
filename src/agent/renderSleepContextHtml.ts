export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { sleepContext: Record<string, any>; events: any[]; agentId: string },
): Promise<string> {
    const sleep = ctx.fns.agent.normalizeSleepContext({ sleepContext: opts.sleepContext });
    if (sleep?.mode !== "compact") return "";
    const generation = ctx.fns.agent.getSleepGeneration({ sleepContext: sleep, kind: "active" });
    if (!generation) return "";
    const contextMessages = generation.contextAgentId
        ? await ctx.fns.session.getMessages({ id: String(generation.contextAgentId) })
        : generation.contextMessages;
    if (!Array.isArray(contextMessages) || contextMessages.length === 0) return "";

    const syntheticEvents = contextMessages.map((message: any) => ({
        type: message.role === "assistant" ? "assistant" : "user",
        text: typeof message.content === "string" ? message.content : JSON.stringify(message.content ?? ""),
        compactContext: true,
    }));
    const syntheticHtml = (await Promise.all(syntheticEvents.map((event: any) =>
        // No agentId: synthetic context is read-only and must not get transcript delete controls.
        ctx.fns.agent.renderEventHtml({ event }),
    ))).join("\n");

    const tailStart = Math.max(0, Number(generation.tailStart ?? generation.sourceOffset ?? 0));
    const tailEvents = opts.events.filter((event: any) => {
        const idx = Number(event?.messageIdx);
        return Number.isInteger(idx) && idx >= tailStart;
    });
    const tailHtml = await ctx.fns.agent.renderEventsHtml({ events: tailEvents, agentId: opts.agentId });
    const sourceOffset = Math.max(0, Number(generation.sourceOffset ?? 0));
    const hidden = Math.max(0, tailStart);

    return `<div class="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
  <div class="flex items-center gap-2 font-medium"><i class="ph ph-moon-stars"></i> Компактный контекст активен</div>
  <div class="mt-1 text-indigo-600">Модель видит консолидацию и свежий хвост. Полная история сохранена; скрыто ${hidden} из ${sourceOffset} исходных сообщений.</div>
</div>\n${syntheticHtml}${tailHtml ? `\n<div class="flex items-center gap-2 py-1 text-[10px] uppercase tracking-wide text-gray-400"><span class="h-px flex-1 bg-gray-200"></span>свежий хвост<span class="h-px flex-1 bg-gray-200"></span></div>\n${tailHtml}` : ""}`;
}
