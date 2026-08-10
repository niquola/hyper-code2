// List members of a Workspace group. ctx.fns.gworkspace.members({ group: "team@health-samurai.io" })
export default async function (ctx: Context, _session: Session | null, opts: { group: string; max?: number; account?: string }) {
    const r = await ctx.fns.gworkspace.api({ path: `/groups/${encodeURIComponent(opts.group)}/members?maxResults=${opts.max ?? 200}`, account: opts.account });
    return (r.members ?? []).map((m: any) => ({ email: m.email, role: m.role, type: m.type, status: m.status, id: m.id }));
}
