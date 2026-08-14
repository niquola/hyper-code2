// Update or close/reopen an issue. Pull requests also use the issues endpoint for
// title/body/state/labels/assignees, but not branch-specific PR fields.
/** Update an issue or its workflow state after explicit confirmation.
 * @param ctx Runtime context.
 * @param _session Unused session supplied by the procedural runtime.
 * @param opts Issue changes.
 * @returns The updated GitHub issue resource.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Repository owner or organization login. */ owner: string;
    /** Repository name. */ repo: string;
    /** Issue number. */ n: number;
    /** Replacement title. */ title?: string;
    /** Replacement Markdown body. */ body?: string;
    /** Replacement open/closed state. */ state?: "open" | "closed";
    /** Reason for the state transition. */ stateReason?: "completed" | "not_planned" | "reopened";
    /** Complete replacement list of label names. */ labels?: string[];
    /** Complete replacement list of assignee logins. */ assignees?: string[];
    /** Milestone number, or `null` to clear it. */ milestone?: number | null;
    /** Must be `true` after explicit user approval. */ confirm?: boolean;
}): Promise<any> {
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
