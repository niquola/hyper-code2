// Update pull-request metadata/state. Requires explicit confirmation.
/** Update pull-request metadata or state after explicit confirmation.
 * @param ctx Runtime context.
 * @param _session Unused session supplied by the procedural runtime.
 * @param opts Pull-request changes.
 * @returns The updated GitHub pull-request resource.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Repository owner or organization login. */ owner: string;
    /** Repository name. */ repo: string;
    /** Pull-request number. */ n: number;
    /** Replacement title. */ title?: string;
    /** Replacement Markdown body. */ body?: string;
    /** Replacement open/closed state. */ state?: "open" | "closed";
    /** Replacement target branch. */ base?: string;
    /** Whether maintainers may modify the source branch. */ maintainerCanModify?: boolean;
    /** Must be `true` after explicit user approval. */ confirm?: boolean;
}): Promise<any> {
    if (!opts?.owner || !opts.repo || !opts.n) throw new Error("gh.updatePr requires owner, repo and n");
    const changes = [opts.title, opts.body, opts.state, opts.base, opts.maintainerCanModify];
    if (changes.every(v => v === undefined)) throw new Error("gh.updatePr requires at least one change");
    if (opts.confirm !== true) throw new Error("gh.updatePr is a real write; repeat with confirm: true after explicit user approval");
    return ctx.fns.gh.api({
        route: "PATCH /repos/{owner}/{repo}/pulls/{n}", path: { owner: opts.owner, repo: opts.repo, n: opts.n }, confirm: true,
        body: {
            ...(opts.title !== undefined ? { title: opts.title } : {}),
            ...(opts.body !== undefined ? { body: opts.body } : {}),
            ...(opts.state !== undefined ? { state: opts.state } : {}),
            ...(opts.base !== undefined ? { base: opts.base } : {}),
            ...(opts.maintainerCanModify !== undefined ? { maintainer_can_modify: opts.maintainerCanModify } : {}),
        },
    });
}
