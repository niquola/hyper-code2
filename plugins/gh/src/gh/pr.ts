// Get a single PR, optionally with changed files and reviews.
//   ctx.fns.gh.pr({ owner, repo, n: 1 })
//   ctx.fns.gh.pr({ owner, repo, n: 1, files: true, reviews: true })
//     → { ...pr, files: [{ filename, status, additions, deletions, ... }], reviews: [...] }
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { owner: string; repo: string; n: number; files?: boolean; reviews?: boolean },
) {
    const { owner, repo, n } = opts;
    const pr = await ctx.fns.gh.api({ route: "GET /repos/{owner}/{repo}/pulls/{n}", path: { owner, repo, n } });
    const out: any = pr;
    if (opts.files) {
        out.files = await ctx.fns.gh.api({
            route: "GET /repos/{owner}/{repo}/pulls/{n}/files",
            path: { owner, repo, n },
            per_page: 100,
        });
    }
    if (opts.reviews) {
        out.reviews = await ctx.fns.gh.api({
            route: "GET /repos/{owner}/{repo}/pulls/{n}/reviews",
            path: { owner, repo, n },
            per_page: 100,
        });
    }
    return out;
}
