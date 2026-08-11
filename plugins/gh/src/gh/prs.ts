// List pull requests for a repo. ctx.fns.gh.prs({ owner, repo, state?, max? })
// state: "open" (default) | "closed" | "all".
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { owner: string; repo: string; state?: string; max?: number },
) {
    return await ctx.fns.gh.api({
        route: "GET /repos/{owner}/{repo}/pulls",
        path: { owner: opts.owner, repo: opts.repo },
        params: { state: opts.state ?? "open" },
        per_page: opts.max ?? 30,
    });
}
