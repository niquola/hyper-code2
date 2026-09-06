/**
 * Resolves mentions conservatively by Unicode-normalized exact title or alias equality.
 * Use before direct writes. Partial names, slug collisions and fuzzy search never authorize a match;
 * single-token people and competing exact identities remain ambiguous. Anonymous types (Entity.anonymous)
 * are never matched by label and always resolve as new. This procedure never writes.
 * @param opts.mentions Typed mentions to compare with canonical names and aliases.
 * @param opts.minScore Minimum candidate score; cannot promote uncertain candidates. @default 0.3
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Typed mentions to resolve without modifying the graph. */ mentions: types.knowledge.Mention[];
    /** Minimum candidate score; uncertainty is never promoted. @default 0.3 @minimum 0 @maximum 1 */ minScore?: number;
}): Promise<Array<{ mention: types.knowledge.Mention; resolution: types.knowledge.MentionResolution }>> {
    if (!Array.isArray(opts.mentions) || opts.mentions.length > 40) throw new Error("Expected at most 40 mentions");
    const norm = (s: string) => s.normalize("NFKC").toLocaleLowerCase("und").replace(/\s+/gu, " ").trim();
    const schema = await ctx.fns.knowledge.extractionSchema({});
    const extractable = new Set(schema.types.map(t => t.type));
    const anonymous = new Set(schema.types.filter(t => t.anonymous).map(t => t.type));
    if (opts.mentions.some(m => !extractable.has(m.type))) throw new Error("Unsupported mention type");
    const rows = extractable.size ? await ctx.fns.procs.db.select({ sql: `SELECT id,type,data FROM knowledge.entities WHERE type IN (${[...extractable].map(() => "?").join(",")})`, params: [...extractable] }) : [];
    return opts.mentions.map(mention => {
        if (anonymous.has(mention.type)) return { mention, resolution: { status: "new" as const, candidates: [] } };
        const names = [mention.name, ...(mention.aliases ?? [])].map(norm).filter(Boolean);
        const candidates: types.knowledge.MentionResolution["candidates"] = [];
        for (const row of rows) {
            if (row.type !== mention.type) continue;
            const aliases = Array.isArray(row.data.aka) ? row.data.aka : typeof row.data.aka === "string" ? [row.data.aka] : [];
            const surfaces = [row.data.title, ...aliases].filter((v): v is string => typeof v === "string").map(norm);
            const exact = names.filter(n => surfaces.includes(n));
            const partial = names.some(n => n.length > 2 && surfaces.some(s => s.split(/\s+/u).includes(n)));
            if (!exact.length && !partial) continue;
            const safe = exact.length > 0 && (mention.type !== "Person" || exact.some(n => n.split(/\s+/u).length > 1));
            candidates.push({ id: row.id, title: row.data.title ?? null, score: safe ? 1 : 0.5, via: safe ? "exact-name-or-alias" : "partial-name" });
        }
        candidates.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
        // Do not discard uncertain candidates using minScore: doing so would turn ambiguity into creation.
        const resolution: types.knowledge.MentionResolution = candidates.length === 0
            ? { status: "new", candidates: [] }
            : candidates.length === 1 && candidates[0]!.score === 1
                ? { status: "matched", id: candidates[0]!.id, candidates }
                : { status: "ambiguous", candidates: candidates.slice(0, 5) };
        return { mention, resolution };
    });
}
