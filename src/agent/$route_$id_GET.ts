// GET /agent/:id — an agent is an ordinary application page. The global layout
// owns only the agents rail; this route owns the chat and its agent-specific
// side panel, so navigating to /llms or /files replaces the agent completely.
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const id = opts.params.id!;
    let agent = (ctx.state as any).agent?.[id];
    if (!agent) {
        agent = (await ctx.fns.session?.load?.({ id })) ?? null;
        if (agent) {
            (ctx.state as any).agent ??= {};
            (ctx.state as any).agent[id] = agent;
        }
    }
    if (!agent) return new Response("Not Found", { status: 404 });

    const chat = await ctx.fns.ui.chatColumn({ agentId: id });
    const meta = ctx.fns.ui.agentMetaPanel({ agent });
    // id="chat-panel" is the chat client's mount point: /agent/chat.js loads
    // once for the whole app and (re)binds itself to this element after every
    // swap — Enter-to-send, stick-to-bottom, older-message paging and the tool
    // cards all hang off it. Without the id the page renders and does nothing.
    const main = `<div ${ctx.fns.procs.ui.attr({ page: "agent", id })} class="flex min-h-0 min-w-0 flex-1 bg-gray-50">
  <section id="chat-panel" data-agent-id="${ctx.fns.procs.ui.escape({ text: id })}" class="flex min-w-0 flex-1 flex-col">${chat}</section>
  ${meta}
</div>`;

    return { currentId: id, title: agent.title || id, main };
}
