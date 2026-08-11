// Create a real GitHub issue. Requires explicit confirmation.
export default async function (ctx: Context, _session: Session | null, opts: {
    owner: string; repo: string; title: string; body?: string; labels?: string[]; assignees?: string[]; confirm?: boolean;
}) {
    if (!opts?.owner || !opts.repo || !opts.title) throw new Error("gh.createIssue requires owner, repo and title");
    if (opts.confirm !== true) throw new Error("gh.createIssue is a real write; repeat with confirm: true after explicit user approval");
    return ctx.fns.gh.api({
        route: "POST /repos/{owner}/{repo}/issues", path: { owner: opts.owner, repo: opts.repo }, confirm: true,
        body: { title: opts.title, ...(opts.body ? { body: opts.body } : {}), ...(opts.labels ? { labels: opts.labels } : {}), ...(opts.assignees ? { assignees: opts.assignees } : {}) },
    });
}
