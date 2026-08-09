export default function (ctx: Context, _session: Session | null, opts: { agent: types.agent.Agent }): types.agent.Agent {
    const { agent } = opts;
    agent.messages = agent.parentId ? ctx.fns.session.getFullMessages({ id: agent.id }) : ctx.fns.session.getMessages({ id: agent.id });
    agent.events = ctx.fns.session.getEvents({ id: agent.id });
    return agent;
}
