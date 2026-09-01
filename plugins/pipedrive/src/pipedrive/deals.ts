/** Lists, searches, or fetches Pipedrive deals without modifying them. */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Exact deal ID; when present returns one deal. */ id?: number;
        /** Search term used when ID is absent. */ term?: string;
        /** Pipedrive deal status such as `open`, `won`, `lost`, or `all_not_deleted`. */ status?: string;
        /** Pipeline ID filter. */ pipeline_id?: number;
        /** Stage ID filter. */ stage_id?: number;
        /** Maximum records. @default 100 @minimum 1 @maximum 500 */ limit?: number;
        /** Pagination offset. @default 0 @minimum 0 */ start?: number;
    },
): Promise<any> {
    if (opts.id != null) return ctx.fns.pipedrive.api({ path: `/deals/${opts.id}` });
    const limit = Math.max(1, Math.min(opts.limit ?? 100, 500));
    if (opts.term) {
        const data = await ctx.fns.pipedrive.api({ path: "/deals/search", params: { term: opts.term, limit } });
        return (data?.items ?? []).map((row: any) => row.item);
    }
    return ctx.fns.pipedrive.api({ path: "/deals", params: { status: opts.status, pipeline_id: opts.pipeline_id, stage_id: opts.stage_id, limit, start: Math.max(0, opts.start ?? 0) } });
}
