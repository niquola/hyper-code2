// Authenticated user info. ctx.fns.gh.me({})
export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    return await ctx.fns.gh.api({ route: "GET /user" });
}
