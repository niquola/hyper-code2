// Merge a pull request. This is destructive/irreversible in normal workflow and
// requires explicit confirmation on every call.
/** Merge a pull request after explicit confirmation.
 * @param ctx Runtime context.
 * @param _session Unused session supplied by the procedural runtime.
 * @param opts Merge options.
 * @returns GitHub's pull-request merge result.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Repository owner or organization login. */ owner: string;
    /** Repository name. */ repo: string;
    /** Pull-request number. */ n: number;
    /** Merge strategy; defaults to `squash`. */ method?: "merge" | "squash" | "rebase";
    /** Optional resulting commit title. */ title?: string;
    /** Optional resulting commit message. */ message?: string;
    /** Expected pull-request head SHA. */ sha?: string;
    /** Must be `true` after explicit user approval. */ confirm?: boolean;
}): Promise<any> {
    if (!opts?.owner || !opts.repo || !opts.n) throw new Error("gh.merge requires owner, repo and n");
    if (opts.method && !(["merge", "squash", "rebase"] as string[]).includes(opts.method)) throw new Error("gh.merge method must be merge, squash or rebase");
    if (opts.confirm !== true) throw new Error("gh.merge is destructive; repeat with confirm: true after explicit user approval");
    return ctx.fns.gh.api({
        route: "PUT /repos/{owner}/{repo}/pulls/{n}/merge",
        path: { owner: opts.owner, repo: opts.repo, n: opts.n },
        confirm: true,
        body: {
            merge_method: opts.method ?? "squash",
            ...(opts.title !== undefined ? { commit_title: opts.title } : {}),
            ...(opts.message !== undefined ? { commit_message: opts.message } : {}),
            ...(opts.sha ? { sha: opts.sha } : {}),
        },
    });
}
