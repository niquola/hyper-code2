/**
 * gcs.objects — list objects in a bucket.
 *   ctx.fns.gcs.objects({ bucket: "niquola-public", prefix: "reports/" })
 * One API page by default; { all: true } paginates and returns every item.
 * Returns { items, prefixes?, nextPageToken? } (page) or an array (all:true).
 */
/**
 * Lists objects in a Google Cloud Storage bucket.
 *
 * @param ctx Runtime context.
 * @param session Active session, when available.
 * @param opts Operation options.
 * @returns The operation result.
 */
export default async function (ctx: Context, session: Session | null, opts: {
        /** Bucket name. */
        bucket: string;
        /** Object-name prefix filter. */
        prefix?: string;
        /** Delimiter used to group object names. */
        delimiter?: string;
        /** Maximum results per API page. */
        maxResults?: number;
        /** Continuation token. */
        pageToken?: string;
        /** Whether to retrieve every page. */
        all?: boolean;
    }) {
    if (!opts?.bucket) throw new Error("bucket is required");
    const page = async (pageToken?: string) => {
        const query: Record<string, string | number> = {};
        if (opts.prefix) query.prefix = opts.prefix;
        if (opts.delimiter) query.delimiter = opts.delimiter;
        query.maxResults = opts.maxResults ?? (opts.all ? 1000 : 100);
        if (pageToken) query.pageToken = pageToken;
        return ctx.fns.gcs.api({ route: "GET /b/{bucket}/o", params: { bucket: opts.bucket }, query });
    };

    if (!opts.all) return page(opts.pageToken);

    const items: any[] = [];
    let token: string | undefined = opts.pageToken;
    do {
        const res = await page(token);
        for (const it of res?.items ?? []) items.push(it);
        token = res?.nextPageToken;
    } while (token);
    return items;
}
