export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { events: any[]; agentId: string },
): Promise<string> {
    const { events, agentId } = opts;

    // Always render, never serve a cached bubble: an event is data, and the
    // markup is a view of it that may change between two page loads (a tool
    // card ages, a renderer improves). Rendering a full transcript is ~7 ms.
    return (await Promise.all(
        events.map((event: any) => ctx.fns.agent.renderEventHtml({ event, agentId })),
    )).join("\n");
} 