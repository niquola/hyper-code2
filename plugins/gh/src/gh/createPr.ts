// Create a real pull request. Requires explicit confirmation.
/** Create a pull request after explicit confirmation.
 * @param ctx Runtime context.
 * @param _session Unused session supplied by the procedural runtime.
 * @param opts Pull-request creation options.
 * @returns The created GitHub pull-request resource.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Repository owner or organization login. */ owner: string;
    /** Repository name. */ repo: string;
    /** Pull-request title. */ title: string;
    /** Source branch or `owner:branch` ref. */ head: string;
    /** Target branch name. */ base: string;
    /** Optional Markdown pull-request body. */ body?: string;
    /** Whether to create the pull request as a draft. */ draft?: boolean;
    /** Whether maintainers may modify the source branch. */ maintainerCanModify?: boolean;
    /** Must be `true` after explicit user approval. */ confirm?: boolean;
}): Promise<any> {
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
