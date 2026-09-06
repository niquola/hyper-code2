/**
 * Deterministically matches an anonymous record (Event, EventParticipation, …) against existing
 * entities by its identity fields, so that repeated mentions never create duplicates.
 *
 * Identity = the type's required attributes (`Entity.required` minus `title`). Candidates are rows
 * of the same type equal on every identity field; `date`/`datetime` fields compare by calendar day.
 * When every identity field is a reference (e.g. EventParticipation = event × participant) a single
 * candidate is `matched` outright. When identity contains scalars (e.g. Event = kind × start) a
 * candidate needs corroboration: a shared non-Concept entity among the candidate's outgoing links and
 * the links of hubs pointing at it (participations → participants) versus `linked`. Exactly one
 * corroborated candidate → `matched`; several → `ambiguous`; candidates whose links are known and
 * disjoint from `linked` → distinct (`new`); a candidate with unknown links → `ambiguous`.
 * Never writes. Use from the sidecar writer before creating an anonymous record.
 * @param opts.type Anonymous extractable type name, e.g. `Event`.
 * @param opts.identity Resolved identity values keyed by attribute (canonical IDs for refs).
 * @param opts.linked Canonical IDs of entities linked to the mention through non-identity relations, including participants reported in the same batch.
 * @param opts.pending Records created earlier in the same batch whose attributes/relations are not persisted yet: id → { type, identity, links }.
 * @param opts.tx Optional open transaction (`unsafe(sql, params)`) so the caller's snapshot is used.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Anonymous extractable type name, e.g. `Event`. */ type: string;
    /** Resolved identity values keyed by attribute; canonical IDs for reference attributes. */ identity: Record<string, string | string[]>;
    /** Canonical IDs linked to the mention via non-identity relations (organizer, about, participants from the same batch). */ linked?: string[];
    /** Optional open transaction exposing `unsafe(sql, params)`; defaults to the framework pool. */ tx?: { unsafe: (sql: string, params?: unknown[]) => Promise<any[]> };
    /** Records created earlier in the same batch, not yet persisted: id → { type, identity values, linked canonical IDs }. */ pending?: Record<string, { type: string; identity?: Record<string, string | string[]>; links: string[] }>;
}): Promise<types.knowledge.MentionResolution> {
    const q = (sql: string, params: unknown[]) => opts.tx ? opts.tx.unsafe(sql, params) : ctx.fns.procs.db.select({ sql: sql.replace(/\$\d+/g, "?"), params: [...sql.matchAll(/\$(\d+)/g)].map(m => params[Number(m[1]) - 1]) });
    const schema = await ctx.fns.knowledge.extractionSchema({ tx: opts.tx });
    const spec = schema.types.find(t => t.type === opts.type);
    if (!spec?.anonymous) throw new Error(`Not an anonymous extractable type: ${opts.type}`);
    const keys = spec.required;
    if (!keys.length || keys.some(k => opts.identity[k] == null || opts.identity[k] === "")) throw new Error("Incomplete identity");
    const attr = (k: string) => schema.attributes.find(a => a.name === k && a.domain.includes(opts.type));
    const temporal = new Set(keys.filter(k => ["date", "datetime"].includes(attr(k)?.datatype ?? "")));
    const scalarIdentity = keys.some(k => attr(k)?.datatype !== "ref");
    const day = (v: unknown) => typeof v === "string" ? v.slice(0, 10) : JSON.stringify(v);
    const exact = Object.fromEntries(keys.filter(k => !temporal.has(k)).map(k => [k, opts.identity[k]]));
    const rows: Array<{ id: string; data: Record<string, any> }> = await q("SELECT id,data FROM knowledge.entities WHERE type=$1 AND data @> $2::jsonb", [opts.type, JSON.stringify(exact)]);
    const sameDay = (data: Record<string, any>) => [...temporal].every(k => day(data[k]) === day(opts.identity[k]));
    const pendingRows = Object.entries(opts.pending ?? {}).filter(([, p]) => p.type === opts.type && p.identity && Object.entries(exact).every(([k, v]) => JSON.stringify(p.identity![k]) === JSON.stringify(v))).map(([id, p]) => ({ id, data: { ...p.identity!, title: null } }));
    const same = [...rows.filter(r => sameDay(r.data)), ...pendingRows.filter(r => sameDay(r.data) && !rows.some(x => x.id === r.id))];
    const candidate = (id: string, title: string | null, score: number, via: string) => ({ id, title, score, via });
    if (!same.length) return { status: "new", candidates: [] };
    if (!scalarIdentity) {
        const c = same.map(r => candidate(r.id, r.data.title ?? null, 1, "identity"));
        return same.length === 1 ? { status: "matched", id: c[0]!.id, candidates: c } : { status: "ambiguous", candidates: c.slice(0, 5) };
    }
    // Corroboration: non-Concept entities reachable from the candidate directly or through hubs pointing at it.
    const ids = same.map(r => r.id);
    const edges: Array<{ subject: string; predicate: string; object: string }> = await q("SELECT subject,predicate,object FROM knowledge.relations WHERE subject IN (SELECT jsonb_array_elements_text($1::jsonb)) OR object IN (SELECT jsonb_array_elements_text($1::jsonb))", [JSON.stringify(ids)]);
    const hubs = [...new Set(edges.filter(e => ids.includes(e.object)).map(e => e.subject))];
    const hubEdges: typeof edges = hubs.length ? await q("SELECT subject,predicate,object FROM knowledge.relations WHERE subject IN (SELECT jsonb_array_elements_text($1::jsonb))", [JSON.stringify(hubs)]) : [];
    const usable = (o: string) => !o.startsWith("Concept/");
    const linkedOf = (id: string) => {
        const out = new Set<string>((opts.pending?.[id]?.links ?? []).filter(o => !keys.includes(o) && usable(o)));
        for (const [hub, p] of Object.entries(opts.pending ?? {})) if (hub !== id && p.links.includes(id)) for (const o of p.links) if (o !== id && usable(o)) out.add(o);
        for (const e of edges) if (e.subject === id && !keys.includes(e.predicate) && usable(e.object)) out.add(e.object);
        for (const h of edges.filter(e => e.object === id).map(e => e.subject)) for (const e of hubEdges) if (e.subject === h && e.object !== id && usable(e.object)) out.add(e.object);
        return out;
    };
    const mine = new Set((opts.linked ?? []).filter(usable));
    const scored = same.map(r => { const l = linkedOf(r.id); const shared = [...l].filter(x => mine.has(x)); return { r, l, shared }; });
    const corroborated = scored.filter(s => s.shared.length);
    const list = (xs: typeof scored, score: number, via: string) => xs.map(s => candidate(s.r.id, s.r.data.title ?? null, score, via));
    if (corroborated.length === 1) return { status: "matched", id: corroborated[0]!.r.id, candidates: list(corroborated, 1, "identity+shared-link") };
    if (corroborated.length > 1) return { status: "ambiguous", candidates: list(corroborated, 0.7, "identity+shared-link").slice(0, 5) };
    const distinct = scored.every(s => s.l.size > 0 && mine.size > 0);
    return distinct ? { status: "new", candidates: list(scored, 0.3, "identity-disjoint-links") } : { status: "ambiguous", candidates: list(scored, 0.5, "identity-unverified").slice(0, 5) };
}
