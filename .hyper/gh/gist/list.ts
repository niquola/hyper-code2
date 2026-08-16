/**
 * Lists GitHub Gists visible to the authenticated user.
 *
 * List the authenticated user’s GitHub Gists with compact metadata. Use to discover Gist IDs before reading, updating, or deleting a Gist.
 * @param opts.max Maximum number of Gists to return. @default 30 @minimum 1 @maximum 100
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Maximum number of Gists to return. @default 30 @minimum 1 @maximum 100 */
        max?: number;
    },
): Promise<Array<{ id: string; description: string; public: boolean; url: string; files: string[]; updatedAt: string }>> {
    const max = Math.max(1, Math.min(opts.max ?? 30, 100));
    const rows = await ctx.fns.gh.api({ route: "GET /gists", per_page: max });
    return (Array.isArray(rows) ? rows : []).slice(0, max).map((gist: any) => ({ id: String(gist.id), description: String(gist.description ?? ""), public: Boolean(gist.public), url: String(gist.html_url ?? ""), files: Object.keys(gist.files ?? {}), updatedAt: String(gist.updated_at ?? "") }));
}
