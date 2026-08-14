/**
 * Searches documentation of functions loaded in the current runtime.
 *
 * Name matches rank above prose matches. Results are compact; call
 * `runtime.docs.get` to inspect the full schema of a selected function.
 */
export default function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Words to find in names, docs, parameter names, and parameter docs. */
        query: string;
        /** Maximum number of compact matches. @default 10 @minimum 1 @maximum 50 */
        limit?: number;
    },
): Array<{ name: string; summary: string; signature: string; rel: string; score: number }> {
    const words = String(opts.query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    const limit = Math.max(1, Math.min(50, Math.floor(opts.limit ?? 10)));
    const all: any[] = [];
    const walk = (node: any) => {
        for (const value of Object.values(node ?? {})) {
            if (typeof value === "function" && (value as any).meta) all.push((value as any).meta);
            else if (value && typeof value === "object") walk(value);
        }
    };
    walk(ctx.state.registry);
    const score = (meta: any): number => {
        const name = String(meta.name ?? "").toLowerCase();
        const prose = `${meta.summary ?? ""} ${meta.doc ?? ""} ${JSON.stringify(meta.paramsSchema ?? {})}`.toLowerCase();
        let matched = 0;
        const points = words.reduce((sum, word) => {
            if (name === word) { matched++; return sum + 20; }
            if (name.includes(word)) { matched++; return sum + 6; }
            if (prose.includes(word)) { matched++; return sum + 2; }
            return sum;
        }, 0);
        // Prefer an entry that answers the whole query over an accidental strong
        // name match for only one of its words.
        return points + (words.length > 1 && matched === words.length ? 10 : 0);
    };
    return all.map(meta => ({ meta, score: score(meta) }))
        .filter(hit => !words.length || hit.score > 0)
        .sort((a, b) => b.score - a.score || a.meta.name.localeCompare(b.meta.name))
        .slice(0, limit)
        .map(({ meta, score }) => ({ name: meta.name, summary: meta.summary, signature: meta.signature, rel: meta.rel, score }));
}
