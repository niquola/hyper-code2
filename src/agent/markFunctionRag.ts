/** Adds function-RAG metadata and refreshed HTML to the matching user event. */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Agent whose user event is annotated. */
        agent: types.agent.Agent;
        /** Message index associated with the user event. */
        messageIdx: number;
        /** Retrieved runtime function descriptions. */
        functions: Array<{ name: string; summary: string; signature: string; score?: number; rank?: number; bm25?: number | null; similarity?: number | null }>;
        /** Exact compact block appended to the outgoing user message. */
        injected: string;
    },
): Promise<{ updated: boolean }> {
    const events = await ctx.fns.session.getEvents({ id: opts.agent.id });
    const event = events.find((item: any) => item.type === "user" && Number(item.messageIdx) === Number(opts.messageIdx));
    if (!event) return { updated: false };
    event.functionRag = {
        functions: opts.functions.slice(0, 5),
        injected: String(opts.injected).slice(0, 6000),
    };
    event.html = await ctx.fns.agent.renderEventHtml({ event, agentId: opts.agent.id });
    const result = await ctx.fns.procs.db.run({
        sql: "UPDATE events SET payload=? WHERE agent_id=? AND idx=?",
        params: [JSON.stringify(event), opts.agent.id, event.idx],
    });
    if (result.changes) {
        const local = opts.agent.events?.find((item: any) => Number(item.idx) === Number(event.idx));
        if (local) Object.assign(local, event);
        ctx.fns.procs.events.refresh({ topic: `agent:${opts.agent.id}`, reason: "function-rag" });
    }
    return { updated: result.changes > 0 };
}
