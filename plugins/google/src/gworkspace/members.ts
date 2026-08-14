// List members of a Workspace group. ctx.fns.gworkspace.members({ group: "team@health-samurai.io" })
/**
 * List members of a Google Workspace group.
 *
 * @param opts - Options for the operation.
 * @param opts.group - Google Workspace group email or identifier.
 * @param opts.max - Maximum number of results to return.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (ctx: Context, _session: Session | null, opts: { group: string; max?: number; account?: string }) {
    const r = await ctx.fns.gworkspace.api({ path: `/groups/${encodeURIComponent(opts.group)}/members?maxResults=${opts.max ?? 200}`, account: opts.account });
    return (r.members ?? []).map((m: any) => ({ email: m.email, role: m.role, type: m.type, status: m.status, id: m.id }));
}
