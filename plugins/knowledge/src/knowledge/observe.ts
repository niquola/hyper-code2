/**
 * Records a sourced observation without coupling the graph to its producer.
 * Source plugins such as a future LinkedIn plugin should submit provenance here.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Existing `Type/slug` entity. */ subject: string;
    /** Observed canonical attribute. */ attribute: string;
    /** Observed JSON-compatible value. */ value?: any;
    /** Source system or document. */ source: string;
    /** Source URL. */ url?: string;
    /** Supporting quote or summary. */ evidence?: string;
    /** Confidence from zero through one. @minimum 0 @maximum 1 */ confidence?: number;
    /** ISO observation timestamp. */ observedAt?: string;
    /** Observation status. @default observed */ status?: string;
}): Promise<{ id: number; subject: string; attribute: string }> {
    await ctx.fns.knowledge.ensure({});
    if (!(await ctx.fns.procs.db.select({ sql: "SELECT 1 FROM knowledge.entities WHERE id=?", params: [opts.subject] })).length)
        throw new Error(`knowledge.observe: unknown subject ${opts.subject}`);
    const rows = await ctx.fns.procs.db.select({
        sql: `INSERT INTO knowledge.provenance(subject,attribute,value,source,url,evidence,confidence,observed_at,status)
              VALUES(?,?,?::jsonb,?,?,?,?,CAST(? AS timestamptz),?)
              ON CONFLICT(subject,attribute,source,url,evidence) DO UPDATE SET
                value=excluded.value,confidence=excluded.confidence,observed_at=excluded.observed_at,status=excluded.status
              RETURNING id,subject,attribute`,
        params: [opts.subject, opts.attribute, JSON.stringify(opts.value ?? null), opts.source, opts.url ?? null, opts.evidence ?? null, opts.confidence ?? null, opts.observedAt ?? null, opts.status ?? "observed"],
    });
    return rows[0] as { id: number; subject: string; attribute: string };
}
