// Search GitHub. ctx.fns.gh.search({ q: "repo:HL7/fhir is:issue SQL on FHIR" })
// kind: "issues" (default, covers issues & PRs) | "code" | "repositories" | "commits" | "users".
// Returns the raw search envelope: { total_count, incomplete_results, items: [...] }.
/** Search GitHub issues, code, repositories, commits, or users.
 * @param ctx Runtime context.
 * @param _session Unused session supplied by the procedural runtime.
 * @param opts Search options.
 * @returns GitHub's raw search result envelope.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** GitHub search query, including any qualifiers. */ q: string;
        /** Search collection; defaults to `issues`. */ kind?: "issues" | "code" | "repositories" | "commits" | "users";
        /** GitHub sort field supported by the selected collection. */ sort?: string;
        /** Sort direction, conventionally `asc` or `desc`. */ order?: string;
        /** Maximum requested results; defaults to 30. */ max?: number;
    },
): Promise<any> {
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
