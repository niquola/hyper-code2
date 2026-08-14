// List Workspace groups (optionally for a user or domain).
//   ctx.fns.gworkspace.groups({ domain: "health-samurai.io" })
//   ctx.fns.gworkspace.groups({ userKey: "pavel@health-samurai.io" })  // groups a user belongs to
/**
 * List Google Workspace groups.
 *
 * @param opts - Options for the operation.
 * @param opts.domain - Workspace domain used to constrain results.
 * @param opts.userKey - User email, alias, or unique identifier.
 * @param opts.max - Maximum number of results to return.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (ctx: Context, _session: Session | null, opts?: { domain?: string; userKey?: string; max?: number; account?: string }) {
    const p = new URLSearchParams();
    if (opts?.userKey) p.set("userKey", opts.userKey);
    else if (opts?.domain) p.set("domain", opts.domain);
    else p.set("customer", "my_customer");
    p.set("maxResults", String(opts?.max ?? 200));
    const r = await ctx.fns.gworkspace.api({ path: `/groups?${p}`, account: opts?.account });
    return (r.groups ?? []).map((g: any) => ({ email: g.email, name: g.name, description: g.description, members: g.directMembersCount, id: g.id }));
}
