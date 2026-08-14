// Get one directory user by email or id. ctx.fns.gworkspace.user({ key: "pavel@health-samurai.io" })
/**
 * Get a Google Workspace user.
 *
 * @param opts - Options for the operation.
 * @param opts.key - User email, alias, or unique identifier.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (ctx: Context, _session: Session | null, opts: { key: string; account?: string }) {
    const u = await ctx.fns.gworkspace.api({ path: `/users/${encodeURIComponent(opts.key)}?projection=full`, account: opts.account });
    return {
        email: u.primaryEmail, name: u.name?.fullName,
        title: u.organizations?.find((o: any) => o.primary)?.title ?? u.organizations?.[0]?.title ?? null,
        department: u.organizations?.find((o: any) => o.primary)?.department ?? null,
        phones: (u.phones ?? []).map((p: any) => p.value),
        manager: u.relations?.find((r: any) => r.type === "manager")?.value ?? null,
        orgUnit: u.orgUnitPath, id: u.id, aliases: u.aliases ?? [], suspended: !!u.suspended,
        raw: u,
    };
}
