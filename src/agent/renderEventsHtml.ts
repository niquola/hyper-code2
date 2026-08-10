export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { events: any[]; agentId: string },
): Promise<string> {
    const { events, agentId } = opts;

    return (await Promise.all(events.map(async (event: any) => {
        // Message bubbles are rendered from event data because their
        // presentation depends on DB metadata such as the timestamp.
        if (event.type === "user" || event.type === "assistant") {
            return ctx.fns.agent.renderEventHtml({ event, agentId });
        }

        const cached = event.eventHtml ?? event.html;
        return cached ?? ctx.fns.agent.renderEventHtml({ event, agentId });
    }))).join("\n");
} 