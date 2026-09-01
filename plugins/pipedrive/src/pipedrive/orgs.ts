/** Lists, searches, or fetches Pipedrive organizations without modifying them. */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Exact organization ID; when present returns one organization. */ id?: number;
        /** Search term used when ID is absent. */ term?: string;
        /** Maximum records. @default 100 @minimum 1 @maximum 500 */ limit?: number;
        /** Pagination offset. @default 0 @minimum 0 */ start?: number;
    },
): Promise<any> {
    if (opts.id != null) return ctx.fns.pipedrive.api({ path: `/organizations/${opts.id}` });
    const limit = Math.max(1, Math.min(opts.limit ?? 100, 500));
    if (opts.term) {
        const data = await ctx.fns.pipedrive.api({ path: "/organizations/search", params: { term: opts.term, limit } });
        return (data?.items ?? []).map((row: any) => row.item);
    }
    return ctx.fns.pipedrive.api({ path: "/organizations", params: { limit, start: Math.max(0, opts.start ?? 0) } });
}
