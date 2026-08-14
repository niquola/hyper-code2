// Get a single issue, optionally with its comments.
//   ctx.fns.gh.issue({ owner, repo, n: 42 })
//   ctx.fns.gh.issue({ owner, repo, n: 42, comments: true }) → { ...issue, comments: [...] }
/** Get one issue, optionally including its comments.
 * @param ctx Runtime context.
 * @param _session Unused session supplied by the procedural runtime.
 * @param opts Issue lookup options.
 * @returns The issue resource, augmented with `comments` when requested.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Repository owner or organization login. */ owner: string;
        /** Repository name. */ repo: string;
        /** Issue number. */ n: number;
        /** Whether to fetch and attach up to 100 comments. */ comments?: boolean;
    },
): Promise<any> {
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
