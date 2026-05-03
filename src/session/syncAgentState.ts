export default function (ctx: Context, opts: { agent: types.agent.Agent }): types.agent.Agent {
    const { agent } = opts;
    agent.messages = agent.parentId ? ctx.fns.session.getFullMessages(ctx, { id: agent.id }) : ctx.fns.session.getMessages(ctx, { id: agent.id });
    agent.events = ctx.fns.session.getEvents(ctx, { id: agent.id });
    return agent;
}
