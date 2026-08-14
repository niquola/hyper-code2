// List / search Workspace directory users.
//   ctx.fns.gworkspace.users({ domain: "health-samurai.io" })
//   ctx.fns.gworkspace.users({ query: "Pavel" })          // name/email/phone search (Directory `query` syntax)
// → [{ email, name, title, phone, orgUnit, id, manager, suspended }]
const norm = (u: any) => ({
    email: u.primaryEmail,
    name: u.name?.fullName,
    title: u.organizations?.find((o: any) => o.primary)?.title ?? u.organizations?.[0]?.title ?? null,
    department: u.organizations?.find((o: any) => o.primary)?.department ?? null,
    phone: u.phones?.find((p: any) => p.primary)?.value ?? u.phones?.[0]?.value ?? null,
    orgUnit: u.orgUnitPath,
    manager: u.relations?.find((r: any) => r.type === "manager")?.value ?? null,
    id: u.id,
    suspended: !!u.suspended,
    aliases: u.aliases ?? [],
});

/**
 * List Google Workspace users.
 *
 * @param opts - Options for the operation.
 * @param opts.domain - Workspace domain used to constrain results.
 * @param opts.query - Search query.
 * @param opts.max - Maximum number of results to return.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (ctx: Context, _session: Session | null, opts?: { domain?: string; query?: string; max?: number; account?: string }) {
    const p = new URLSearchParams();
    if (opts?.domain) p.set("domain", opts.domain); else p.set("customer", "my_customer");
    if (opts?.query) p.set("query", opts.query);
    p.set("maxResults", String(opts?.max ?? 100));
    p.set("projection", "full");
    const r = await ctx.fns.gworkspace.api({ path: `/users?${p}`, account: opts?.account });
    return (r.users ?? []).map(norm);
}
