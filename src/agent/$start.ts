// agent module boot: rehydrate persisted agents into ctx.state.agent, then
// start the single in-process worker that drains agent runs. Listed in
// package.json procs.prod after procs/migrate so the schema is ready.
export default async function (ctx: Context, _session: Session | null, _config?: unknown) {
    const rehydrated = ctx.fns.session.loadAll({});
    ctx.fns.procs.log.info({ event: "agent.rehydrated", msg: `${rehydrated.loaded} agent(s)` });
    queueMicrotask(() => {
        ctx.fns.agent.workerLoop({}).catch((e: any) => console.error("[workerLoop] crashed:", e?.message ?? e));
    });
}
