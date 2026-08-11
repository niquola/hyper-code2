// Get a single issue, optionally with its comments.
//   ctx.fns.gh.issue({ owner, repo, n: 42 })
//   ctx.fns.gh.issue({ owner, repo, n: 42, comments: true }) → { ...issue, comments: [...] }
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { owner: string; repo: string; n: number; comments?: boolean },
) {
    const { owner, repo, n } = opts;
    const issue = await ctx.fns.gh.api({ route: "GET /repos/{owner}/{repo}/issues/{n}", path: { owner, repo, n } });
    if (!opts.comments) return issue;
    const comments = await ctx.fns.gh.api({
        route: "GET /repos/{owner}/{repo}/issues/{n}/comments",
        path: { owner, repo, n },
        per_page: 100,
    });
    return { ...issue, comments };
}
