// List issues for a repo. ctx.fns.gh.issues({ owner, repo, state?, labels?, max? })
// state: "open" (default) | "closed" | "all". labels: comma-separated names.
// NOTE: GitHub returns PRs in the issues list too — items with `pull_request` are PRs.
/** List issues in a repository (GitHub may also include pull requests).
 * @param ctx Runtime context.
 * @param _session Unused session supplied by the procedural runtime.
 * @param opts Issue-list options.
 * @returns An array of GitHub issue resources.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Repository owner or organization login. */ owner: string;
        /** Repository name. */ repo: string;
        /** Issue state filter; defaults to `open`. */ state?: string;
        /** Comma-separated label names used to filter results. */ labels?: string;
        /** Maximum requested results; defaults to 30. */ max?: number;
    },
): Promise<any> {
    return await ctx.fns.gh.api({
        route: "GET /repos/{owner}/{repo}/issues",
        path: { owner: opts.owner, repo: opts.repo },
        params: { state: opts.state ?? "open", ...(opts.labels ? { labels: opts.labels } : {}) },
        per_page: opts.max ?? 30,
    });
}
