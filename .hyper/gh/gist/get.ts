/**
 * Reads one GitHub Gist including its files.
 *
 * Fetch one GitHub Gist by ID and return its metadata and file contents. Use when the user asks to inspect or download an existing Gist.
 * @param opts.id GitHub Gist identifier or Gist URL.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** GitHub Gist identifier or Gist URL. */
        id: string;
    },
): Promise<{ id: string; description: string; public: boolean; url: string; files: Record<string, { content: string; truncated: boolean; rawUrl: string }> }> {
    const id = opts.id.split('/').filter(Boolean).pop() ?? opts.id;
    const gist = await ctx.fns.gh.api({ route: "GET /gists/{gist_id}", path: { gist_id: id } });
    const files = Object.fromEntries(Object.entries(gist.files ?? {}).map(([name, file]: [string, any]) => [name, { content: String(file.content ?? ""), truncated: Boolean(file.truncated), rawUrl: String(file.raw_url ?? "") }]));
    return { id: String(gist.id), description: String(gist.description ?? ""), public: Boolean(gist.public), url: String(gist.html_url ?? ""), files };
}
