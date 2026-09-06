/**
 * Builds the schema that drives agent-chat entity extraction from live Knowledge definitions.
 *
 * Reads `Entity/*` records flagged `extract: true` (mixins excluded), every `Attribute/*` whose
 * domain covers one of those types, and the controlled vocabularies referenced by
 * `Attribute.vocabulary` (root Concept plus its `isA`/`subClassOf` descendants). Both the sidecar
 * prompt (`knowledge.updateSidecar`) and the writer (`knowledge.setObservedMentions`) consume this,
 * so adding a type, attribute or vocabulary member in the graph is enough to extract it — no code
 * change. Use it whenever you need the authoritative list of extractable types, their attributes
 * or vocabulary members.
 * @param opts.tx Optional open transaction (`tx.unsafe`) so the writer sees the same snapshot it locks.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Optional open transaction exposing `unsafe(sql)`; defaults to the framework pool. */
    tx?: { unsafe: (sql: string, params?: unknown[]) => Promise<any[]> };
}): Promise<types.knowledge.ExtractionSpec> {
    const q = (sql: string) => opts.tx ? opts.tx.unsafe(sql) : ctx.fns.procs.db.select({ sql, params: [] });
    const list = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : typeof v === "string" ? [v] : [];
    const rows: Array<{ id: string; type: string; data: Record<string, any> }> = await q("SELECT id,type,data FROM knowledge.entities WHERE type IN ('Entity','Attribute','Concept')");
    const entities = rows.filter(r => r.type === "Entity" && r.data?.extract === true && !r.data?.mixin);
    const types: types.knowledge.ExtractionSpec["types"] = entities.map(e => ({
        type: e.id.slice(7),
        description: String(e.data.description ?? e.data.title ?? ""),
        anonymous: e.data.anonymous === true,
        required: list(e.data.required).filter(k => k !== "title"),
        hint: typeof e.data.extract_hint === "string" ? e.data.extract_hint : undefined,
    }));
    const typeIds = new Set(types.map(t => `Entity/${t.type}`));
    const concepts = rows.filter(r => r.type === "Concept");
    const parentsOf = (c: { data: Record<string, any> }) => [...list(c.data.isA), ...list(c.data.subClassOf)];
    const descendants = (root: string) => {
        const out: Array<{ id: string; title: string }> = [];
        const seen = new Set<string>([root]);
        let frontier = [root];
        while (frontier.length) {
            const next: string[] = [];
            for (const c of concepts) {
                if (seen.has(c.id) || !parentsOf(c).some(p => frontier.includes(p))) continue;
                seen.add(c.id); next.push(c.id);
                out.push({ id: c.id, title: String(c.data.title ?? c.id.slice(8)) });
            }
            frontier = next;
        }
        return out;
    };
    const vocabularies: types.knowledge.ExtractionSpec["vocabularies"] = {};
    const attributes: types.knowledge.ExtractionSpec["attributes"] = [];
    for (const a of rows.filter(r => r.type === "Attribute")) {
        const name = a.id.slice(10);
        if (!/^[a-z][a-z0-9_]*$/.test(name) || ["base_type", "type", "title", "aka"].includes(name)) continue;
        const domain = list(a.data.domain).filter(d => typeIds.has(d));
        if (!domain.length) continue;
        const vocabulary = typeof a.data.vocabulary === "string" ? a.data.vocabulary : undefined;
        if (vocabulary && !vocabularies[vocabulary]) vocabularies[vocabulary] = descendants(vocabulary);
        attributes.push({
            name,
            datatype: String(a.data.datatype ?? "string"),
            domain: domain.map(d => d.slice(7)),
            range: list(a.data.range).map(r => r.slice(7)),
            cardinality: a.data.cardinality === "multi" ? "multi" : "single",
            vocabulary,
            description: String(a.data.body ?? a.data.title ?? name).slice(0, 400),
        });
    }
    return { types, attributes, vocabularies };
}
