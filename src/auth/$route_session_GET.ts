/** Returns the current password-session identity for native clients. */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const user = await ctx.fns.procs.auth.authenticate({ req: opts.req });
    return user ? Response.json({ authenticated: true, user }) : Response.json({ authenticated: false }, { status: 401 });
}
