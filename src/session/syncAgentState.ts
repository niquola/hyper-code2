export default function (ctx: Context, agent: types.agent.Agent): types.agent.Agent {
    agent.messages = agent.parentId ? ctx.fns.session.getFullMessages(ctx, agent.id) : ctx.fns.session.getMessages(ctx, agent.id);
    agent.events = ctx.fns.session.getEvents(ctx, agent.id);
    return agent;
}
