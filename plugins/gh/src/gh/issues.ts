// List issues for a repo. ctx.fns.gh.issues({ owner, repo, state?, labels?, max? })
// state: "open" (default) | "closed" | "all". labels: comma-separated names.
// NOTE: GitHub returns PRs in the issues list too — items with `pull_request` are PRs.
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { owner: string; repo: string; state?: string; labels?: string; max?: number },
) {
    return await ctx.fns.gh.api({
        route: "GET /repos/{owner}/{repo}/issues",
        path: { owner: opts.owner, repo: opts.repo },
        params: { state: opts.state ?? "open", ...(opts.labels ? { labels: opts.labels } : {}) },
        per_page: opts.max ?? 30,
    });
}
