// gmail.filters — list existing Gmail server-side filters (read-only).
//   ctx.fns.gmail.filters({ account })  → [{ id, criteria, action }]
/**
 * List Gmail filters.
 *
 * @param opts - Options for the operation.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (ctx: Context, _session: Session | null, opts: { account?: string }) {
    const r = await ctx.fns.gmail.api({ account: opts?.account, path: "/settings/filters" });
    return (r?.filter ?? []).map((f: any) => ({
        id: f.id,
        from: f.criteria?.from, to: f.criteria?.to, subject: f.criteria?.subject, query: f.criteria?.query,
        addLabel: f.action?.addLabelIds, removeLabel: f.action?.removeLabelIds, forward: f.action?.forward,
    }));
}
