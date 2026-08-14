// List pull requests for a repo. ctx.fns.gh.prs({ owner, repo, state?, max? })
// state: "open" (default) | "closed" | "all".
/** List pull requests in a repository.
 * @param ctx Runtime context.
 * @param _session Unused session supplied by the procedural runtime.
 * @param opts Pull-request list options.
 * @returns An array of GitHub pull-request resources.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Repository owner or organization login. */ owner: string;
        /** Repository name. */ repo: string;
        /** Pull-request state filter; defaults to `open`. */ state?: string;
        /** Maximum requested results; defaults to 30. */ max?: number;
    },
): Promise<any> {
    return await ctx.fns.gh.api({
        route: "GET /repos/{owner}/{repo}/pulls",
        path: { owner: opts.owner, repo: opts.repo },
        params: { state: opts.state ?? "open" },
        per_page: opts.max ?? 30,
    });
}
