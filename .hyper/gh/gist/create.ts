/**
 * Creates a public or private GitHub Gist from workspace files.
 *
 * Create a GitHub Gist from one or more workspace files after an explicit user request. Set private=true for a secret/unlisted Gist; GitHub secret Gists are not access-controlled and anyone with the URL can read them.
 * @param opts.paths One or more workspace-relative files to upload.
 * @param opts.description Optional Gist description.
 * @param opts.private Create a secret/unlisted Gist when true, or a publicly discoverable Gist when false. @default true
 * @param opts.confirm Explicit confirmation that the user requested this external write; must be true.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** One or more workspace-relative files to upload. */
        paths: string[];
        /** Optional Gist description. */
        description?: string;
        /** Create a secret/unlisted Gist when true, or a publicly discoverable Gist when false. @default true */
        private?: boolean;
        /** Explicit confirmation that the user requested this external write; must be true. */
        confirm: boolean;
    },
): Promise<{ id: string; url: string; public: boolean; files: string[] }> {
    if (opts.confirm !== true) throw new Error("gh.gist.create requires confirm: true after an explicit user request");
    if (!opts.paths.length) throw new Error("gh.gist.create requires at least one path");
    const entries = await Promise.all(opts.paths.map(async path => { const resolved = ctx.fns.files.resolveSafe({ path }); const name = resolved.split('/').pop() || 'gist.txt'; const content = await ctx.fns.files.read({ path }); return [name, { content }] as const; }));
    if (new Set(entries.map(([name]) => name)).size !== entries.length) throw new Error("Gist filenames must be unique; rename duplicate basenames before upload");
    const gist = await ctx.fns.gh.api({ route: "POST /gists", body: { description: opts.description ?? "", public: !(opts.private ?? true), files: Object.fromEntries(entries) }, confirm: true });
    return { id: String(gist.id), url: String(gist.html_url), public: Boolean(gist.public), files: Object.keys(gist.files ?? {}) };
}
