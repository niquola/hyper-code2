// Get a single PR, optionally with changed files and reviews.
//   ctx.fns.gh.pr({ owner, repo, n: 1 })
//   ctx.fns.gh.pr({ owner, repo, n: 1, files: true, reviews: true })
//     → { ...pr, files: [{ filename, status, additions, deletions, ... }], reviews: [...] }
/** Get one pull request, optionally including files and reviews.
 * @param ctx Runtime context.
 * @param _session Unused session supplied by the procedural runtime.
 * @param opts Pull-request lookup options.
 * @returns The pull-request resource, augmented with requested related data.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Repository owner or organization login. */ owner: string;
        /** Repository name. */ repo: string;
        /** Pull-request number. */ n: number;
        /** Whether to fetch and attach up to 100 changed files. */ files?: boolean;
        /** Whether to fetch and attach up to 100 reviews. */ reviews?: boolean;
    },
): Promise<any> {
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
