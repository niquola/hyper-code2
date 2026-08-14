// gmail.filterDelete — delete a Gmail filter by id (reverses gmail.filterCreate). LIVE change.
//   ctx.fns.gmail.filterDelete({ account, id })
/**
 * Delete a Gmail filter.
 *
 * @param opts - Options for the operation.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 * @param opts.id - Resource identifier.
 */
export default async function (ctx: Context, _session: Session | null, opts: { account?: string; id: string }) {
    if (!opts?.id) throw new Error("filterDelete: id required");
    await ctx.fns.gmail.api({ account: opts.account, method: "DELETE", path: `/settings/filters/${opts.id}` });
    return { deleted: opts.id };
}
