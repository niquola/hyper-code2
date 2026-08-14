// Comment on a real issue or pull request. Requires explicit confirmation.
/** Add a comment to an issue or pull request after explicit confirmation.
 * @param ctx Runtime context.
 * @param _session Unused session supplied by the procedural runtime.
 * @param opts Comment options.
 * @returns The created GitHub issue-comment resource.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Repository owner or organization login. */ owner: string;
    /** Repository name. */ repo: string;
    /** Issue or pull-request number. */ n: number;
    /** Markdown comment body. */ body: string;
    /** Must be `true` after explicit user approval. */ confirm?: boolean;
}): Promise<any> {
    if (!opts?.owner || !opts.repo || !opts.n || !opts.body) throw new Error("gh.comment requires owner, repo, n and body");
    if (opts.confirm !== true) throw new Error("gh.comment is a real write; repeat with confirm: true after explicit user approval");
    return ctx.fns.gh.api({
        route: "POST /repos/{owner}/{repo}/issues/{n}/comments", path: { owner: opts.owner, repo: opts.repo, n: opts.n }, body: { body: opts.body }, confirm: true,
    });
}
