// gmail.filterDelete — delete a Gmail filter by id (reverses gmail.filterCreate). LIVE change.
//   ctx.fns.gmail.filterDelete({ account, id })
export default async function (ctx: Context, _session: Session | null, opts: { account?: string; id: string }) {
    if (!opts?.id) throw new Error("filterDelete: id required");
    await ctx.fns.gmail.api({ account: opts.account, method: "DELETE", path: `/settings/filters/${opts.id}` });
    return { deleted: opts.id };
}
