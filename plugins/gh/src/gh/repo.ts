// Get a single repo. ctx.fns.gh.repo({ owner: "HealthSamurai", repo: "aidbox" })
export default async function (ctx: Context, _session: Session | null, opts: { owner: string; repo: string }) {
    return await ctx.fns.gh.api({ route: "GET /repos/{owner}/{repo}", path: { owner: opts.owner, repo: opts.repo } });
}
