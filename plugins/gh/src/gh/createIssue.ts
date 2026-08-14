// Create a real GitHub issue. Requires explicit confirmation.
/** Create a GitHub issue after explicit confirmation.
 * @param ctx Runtime context.
 * @param _session Unused session supplied by the procedural runtime.
 * @param opts Issue creation options.
 * @returns The created GitHub issue resource.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Repository owner or organization login. */ owner: string;
    /** Repository name. */ repo: string;
    /** Issue title. */ title: string;
    /** Optional Markdown issue body. */ body?: string;
    /** Label names to apply. */ labels?: string[];
    /** User logins to assign. */ assignees?: string[];
    /** Must be `true` after explicit user approval. */ confirm?: boolean;
}): Promise<any> {
    if (!opts?.owner || !opts.repo || !opts.title) throw new Error("gh.createIssue requires owner, repo and title");
    if (opts.confirm !== true) throw new Error("gh.createIssue is a real write; repeat with confirm: true after explicit user approval");
    return ctx.fns.gh.api({
        route: "POST /repos/{owner}/{repo}/issues", path: { owner: opts.owner, repo: opts.repo }, confirm: true,
        body: { title: opts.title, ...(opts.body ? { body: opts.body } : {}), ...(opts.labels ? { labels: opts.labels } : {}), ...(opts.assignees ? { assignees: opts.assignees } : {}) },
    });
}
