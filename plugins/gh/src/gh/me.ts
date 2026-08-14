// Authenticated user info. ctx.fns.gh.me({})
/** Get the currently authenticated GitHub user.
 * @param ctx Runtime context.
 * @param _session Unused session supplied by the procedural runtime.
 * @param _opts Empty options object.
 * @returns The authenticated GitHub user resource.
 */
export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<any> {
    return await ctx.fns.gh.api({ route: "GET /user" });
}
