// Create a real pull request. Requires explicit confirmation.
export default async function (ctx: Context, _session: Session | null, opts: {
    owner: string; repo: string; title: string; head: string; base: string;
    body?: string; draft?: boolean; maintainerCanModify?: boolean; confirm?: boolean;
}) {
    if (!opts?.owner || !opts.repo || !opts.title || !opts.head || !opts.base) {
        throw new Error("gh.createPr requires owner, repo, title, head and base");
    }
    if (opts.confirm !== true) throw new Error("gh.createPr is a real write; repeat with confirm: true after explicit user approval");
    return ctx.fns.gh.api({
        route: "POST /repos/{owner}/{repo}/pulls",
        path: { owner: opts.owner, repo: opts.repo },
        confirm: true,
        body: {
            title: opts.title,
            head: opts.head,
            base: opts.base,
            ...(opts.body !== undefined ? { body: opts.body } : {}),
            ...(opts.draft !== undefined ? { draft: opts.draft } : {}),
            ...(opts.maintainerCanModify !== undefined ? { maintainer_can_modify: opts.maintainerCanModify } : {}),
        },
    });
}
