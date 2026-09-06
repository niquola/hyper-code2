/** Renders the neutral home/overview page instead of redirecting into a chat. */
export default async function (ctx: Context, _session: Session | null, _opts: { req: Request; params: Record<string, string> }) {
    return ctx.fns.home.render({});
}
