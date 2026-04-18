export default async function (ctx: Context) {
    const store: Record<string, types.agent.Agent> = (ctx.state as any).agent ?? {};
    const agents = Object.values(store).map((a) => {
        const firstUser = a.events.find((e: any) => e.type === "user");
        return {
            id: a.id,
            model: a.model,
            isStreaming: a.isStreaming,
            turns: a.events.filter((e: any) => e.type === "user").length,
            title: firstUser?.text?.slice(0, 40) ?? "(empty)",
        };
    });
    return Response.json({ agents });
}
