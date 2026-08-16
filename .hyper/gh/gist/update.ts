/**
 * Updates an existing GitHub Gist description and files.
 *
 * Update, add, rename, or delete files in an existing GitHub Gist after an explicit user request. GitHub does not support changing an existing Gist between public and secret; create a replacement to change visibility.
 * @param opts.id GitHub Gist identifier or Gist URL.
 * @param opts.description Replacement description; omit to preserve the current value.
 * @param opts.files File operations: provide path or content to write, newName to rename, or delete=true to remove.
 * @param opts.confirm Explicit confirmation that the user requested this external write; must be true.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** GitHub Gist identifier or Gist URL. */
        id: string;
        /** Replacement description; omit to preserve the current value. */
        description?: string;
        /** File operations: provide path or content to write, newName to rename, or delete=true to remove. */
        files?: Array<{ name: string; path?: string; content?: string; newName?: string; delete?: boolean }>;
        /** Explicit confirmation that the user requested this external write; must be true. */
        confirm: boolean;
    },
): Promise<{ id: string; url: string; public: boolean; files: string[] }> {
    if (opts.confirm !== true) throw new Error("gh.gist.update requires confirm: true after an explicit user request");
    if (opts.description === undefined && !opts.files?.length) throw new Error("gh.gist.update requires description or file operations");
    const id = opts.id.split('/').filter(Boolean).pop() ?? opts.id;
    const files: Record<string, any> = {};
    for (const op of opts.files ?? []) {
      if (!op.name || op.name.includes('/')) throw new Error("Each Gist file name must be a basename");
      if (op.delete) { files[op.name] = null; continue; }
      if (op.path !== undefined && op.content !== undefined) throw new Error(`Provide either path or content for ${op.name}, not both`);
      const content = op.path !== undefined ? await ctx.fns.files.read({ path: op.path }) : op.content;
      if (content === undefined && op.newName === undefined) throw new Error(`File operation for ${op.name} has no change`);
      files[op.name] = { ...(content === undefined ? {} : { content }), ...(op.newName === undefined ? {} : { filename: op.newName }) };
    }
    const body: any = {};
    if (opts.description !== undefined) body.description = opts.description;
    if (Object.keys(files).length) body.files = files;
    const gist = await ctx.fns.gh.api({ route: "PATCH /gists/{gist_id}", path: { gist_id: id }, body, confirm: true });
    return { id: String(gist.id), url: String(gist.html_url), public: Boolean(gist.public), files: Object.keys(gist.files ?? {}) };
}
