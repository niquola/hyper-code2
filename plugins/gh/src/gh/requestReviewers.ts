// Request users and/or teams to review a pull request.
/** Request user and/or team reviews on a pull request.
 * @param ctx Runtime context.
 * @param _session Unused session supplied by the procedural runtime.
 * @param opts Reviewer request options.
 * @returns The updated pull-request resource.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Repository owner or organization login. */ owner: string;
    /** Repository name. */ repo: string;
    /** Pull-request number. */ n: number;
    /** GitHub user logins to request. */ reviewers?: string[];
    /** Organization team slugs to request. */ teamReviewers?: string[];
    /** Must be `true` after explicit user approval. */ confirm?: boolean;
}): Promise<any> {
    if (!opts?.owner || !opts.repo || !opts.n) throw new Error("gh.requestReviewers requires owner, repo and n");
    if (!opts.reviewers?.length && !opts.teamReviewers?.length) throw new Error("gh.requestReviewers requires reviewers or teamReviewers");
    if (opts.confirm !== true) throw new Error("gh.requestReviewers is a real write; repeat with confirm: true after explicit user approval");
    return ctx.fns.gh.api({
        route: "POST /repos/{owner}/{repo}/pulls/{n}/requested_reviewers",
        path: { owner: opts.owner, repo: opts.repo, n: opts.n }, confirm: true,
        body: { reviewers: opts.reviewers ?? [], team_reviewers: opts.teamReviewers ?? [] },
    });
}
