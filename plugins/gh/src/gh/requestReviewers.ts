// Request users and/or teams to review a pull request.
export default async function (ctx: Context, _session: Session | null, opts: {
    owner: string; repo: string; n: number; reviewers?: string[]; teamReviewers?: string[]; confirm?: boolean;
}) {
    if (!opts?.owner || !opts.repo || !opts.n) throw new Error("gh.requestReviewers requires owner, repo and n");
    if (!opts.reviewers?.length && !opts.teamReviewers?.length) throw new Error("gh.requestReviewers requires reviewers or teamReviewers");
    if (opts.confirm !== true) throw new Error("gh.requestReviewers is a real write; repeat with confirm: true after explicit user approval");
    return ctx.fns.gh.api({
        route: "POST /repos/{owner}/{repo}/pulls/{n}/requested_reviewers",
        path: { owner: opts.owner, repo: opts.repo, n: opts.n }, confirm: true,
        body: { reviewers: opts.reviewers ?? [], team_reviewers: opts.teamReviewers ?? [] },
    });
}
