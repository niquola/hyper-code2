// Get a single repo. ctx.fns.gh.repo({ owner: "HealthSamurai", repo: "aidbox" })
/** Get metadata for a GitHub repository.
 * @param ctx Runtime context.
 * @param _session Unused session supplied by the procedural runtime.
 * @param opts Repository coordinates.
 * @returns The GitHub repository resource.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Repository owner or organization login. */ owner: string;
    /** Repository name. */ repo: string;
}): Promise<any> {
    return await ctx.fns.gh.api({ route: "GET /repos/{owner}/{repo}", path: { owner: opts.owner, repo: opts.repo } });
}
