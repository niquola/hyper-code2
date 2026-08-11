// Search GitHub. ctx.fns.gh.search({ q: "repo:HL7/fhir is:issue SQL on FHIR" })
// kind: "issues" (default, covers issues & PRs) | "code" | "repositories" | "commits" | "users".
// Returns the raw search envelope: { total_count, incomplete_results, items: [...] }.
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { q: string; kind?: "issues" | "code" | "repositories" | "commits" | "users"; sort?: string; order?: string; max?: number },
) {
    const kind = opts.kind ?? "issues";
    return await ctx.fns.gh.api({
        route: `GET /search/${kind}`,
        params: {
            q: opts.q,
            ...(opts.sort ? { sort: opts.sort } : {}),
            ...(opts.order ? { order: opts.order } : {}),
        },
        per_page: opts.max ?? 30,
    });
}
