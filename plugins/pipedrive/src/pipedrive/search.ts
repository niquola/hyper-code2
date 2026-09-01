/** Searches deals, people, and organizations through Pipedrive global search. */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Text to search across CRM records. */ term: string;
        /** Maximum matches. @default 20 @minimum 1 @maximum 100 */ limit?: number;
    },
): Promise<Array<{ type: string; id: number; title: string; org?: string }>> {
    const term = String(opts.term ?? "").trim();
    if (!term) throw new Error("pipedrive.search: term is required");
    const data = await ctx.fns.pipedrive.api({ path: "/itemSearch", params: { term, limit: Math.max(1, Math.min(opts.limit ?? 20, 100)) } });
    return (data?.items ?? []).map((row: any) => ({ type: row.item.type, id: row.item.id, title: row.item.title ?? row.item.name, org: row.item.organization?.name }));
}
