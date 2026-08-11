// Update pull-request metadata/state. Requires explicit confirmation.
export default async function (ctx: Context, _session: Session | null, opts: {
    owner: string; repo: string; n: number;
    title?: string; body?: string; state?: "open" | "closed";
    base?: string; maintainerCanModify?: boolean; confirm?: boolean;
}) {
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
