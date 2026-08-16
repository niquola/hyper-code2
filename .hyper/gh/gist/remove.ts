/**
 * Permanently deletes a GitHub Gist.
 *
 * Delete a GitHub Gist permanently after the user explicitly requests deletion. Use only with confirm=true; this operation is destructive and cannot be undone through the API.
 * @param opts.id GitHub Gist identifier or Gist URL.
 * @param opts.confirm Explicit confirmation that the user requested permanent deletion; must be true.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** GitHub Gist identifier or Gist URL. */
        id: string;
        /** Explicit confirmation that the user requested permanent deletion; must be true. */
        confirm: boolean;
    },
): Promise<{ id: string; deleted: true }> {
    if (opts.confirm !== true) throw new Error("gh.gist.remove requires confirm: true after an explicit deletion request");
    const id = opts.id.split('/').filter(Boolean).pop() ?? opts.id;
    await ctx.fns.gh.api({ route: "DELETE /gists/{gist_id}", path: { gist_id: id }, confirm: true });
    return { id, deleted: true };
}
