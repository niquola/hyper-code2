/** List or search live runtime function metadata for an authenticated local harness. */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request }): Promise<Response> {
    const auth = await ctx.fns.external.authorize({ req: opts.req });
    if (!auth.ok) return auth.response;
    const url = new URL(opts.req.url);
    const query = String(url.searchParams.get("q") ?? "").trim();
    const namespace = String(url.searchParams.get("namespace") ?? "").trim();
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? 50)));
    try {
        if (query) return Response.json(await ctx.fns.runtime.docs.search({ query, namespace: namespace || undefined, limit }));
        const rows = await ctx.fns.procs.db.select({
            sql: `SELECT name, namespace, summary, signature, return_type AS "returnType", rel
                    FROM functions
                   WHERE (? = '' OR namespace = ? OR name LIKE ?)
                   ORDER BY name
                   LIMIT ?`,
            params: [namespace, namespace, `${namespace}.%`, limit],
        });
        return Response.json(rows);
    } catch (error: any) {
        return Response.json({ error: String(error?.message ?? error) }, { status: 400 });
    }
}
