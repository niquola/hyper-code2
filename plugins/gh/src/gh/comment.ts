// Comment on a real issue or pull request. Requires explicit confirmation.
export default async function (ctx: Context, _session: Session | null, opts: {
    owner: string; repo: string; n: number; body: string; confirm?: boolean;
}) {
    if (!opts?.owner || !opts.repo || !opts.n || !opts.body) throw new Error("gh.comment requires owner, repo, n and body");
    if (opts.confirm !== true) throw new Error("gh.comment is a real write; repeat with confirm: true after explicit user approval");
    return ctx.fns.gh.api({
        route: "POST /repos/{owner}/{repo}/issues/{n}/comments", path: { owner: opts.owner, repo: opts.repo, n: opts.n }, body: { body: opts.body }, confirm: true,
    });
}
