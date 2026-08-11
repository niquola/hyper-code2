// Update or close/reopen an issue. Pull requests also use the issues endpoint for
// title/body/state/labels/assignees, but not branch-specific PR fields.
export default async function (ctx: Context, _session: Session | null, opts: {
    owner: string; repo: string; n: number;
    title?: string; body?: string; state?: "open" | "closed";
    stateReason?: "completed" | "not_planned" | "reopened";
    labels?: string[]; assignees?: string[]; milestone?: number | null;
    confirm?: boolean;
}) {
    if (!opts?.owner || !opts.repo || !opts.n) throw new Error("gh.updateIssue requires owner, repo and n");
    const changes = [opts.title, opts.body, opts.state, opts.stateReason, opts.labels, opts.assignees, opts.milestone];
    if (changes.every(v => v === undefined)) throw new Error("gh.updateIssue requires at least one change");
    if (opts.confirm !== true) throw new Error("gh.updateIssue is a real write; repeat with confirm: true after explicit user approval");
    return ctx.fns.gh.api({
        route: "PATCH /repos/{owner}/{repo}/issues/{n}",
        path: { owner: opts.owner, repo: opts.repo, n: opts.n },
        confirm: true,
        body: {
            ...(opts.title !== undefined ? { title: opts.title } : {}),
            ...(opts.body !== undefined ? { body: opts.body } : {}),
            ...(opts.state !== undefined ? { state: opts.state } : {}),
            ...(opts.stateReason !== undefined ? { state_reason: opts.stateReason } : {}),
            ...(opts.labels !== undefined ? { labels: opts.labels } : {}),
            ...(opts.assignees !== undefined ? { assignees: opts.assignees } : {}),
            ...(opts.milestone !== undefined ? { milestone: opts.milestone } : {}),
        },
    });
}
