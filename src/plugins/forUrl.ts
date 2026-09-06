/**
 * Finds mounted plugins whose trusted domains metadata matches an HTTP website URL.
 *
 * Use for deterministic website routing without semantic search or page-title matching. Exact hosts match literally; *.example.com matches only dot-delimited subdomains, not the root. Ports never widen a host rule; local hosts and IPs are excluded.
 * @param opts.url Current website URL; invalid, non-HTTP, local and IP URLs return no matches.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Current website URL; invalid, non-HTTP, local and IP URLs return no matches. */
        url: string;
    },
): Promise<Array<{ name: string; description: string; domains: string[] }>> {
    if (opts.url.length > 4096) return [];
    let host: string;
    try { const u = new URL(opts.url); if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) return []; host = u.hostname.toLowerCase(); } catch { return []; }
    const valid = (h: string) => h.length <= 253 && h.includes('.') && !h.endsWith('.localhost') && h !== 'localhost' && !/^[\d.]+$/.test(h) && h.split('.').every(p => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(p));
    if (!valid(host)) return [];
    return ctx.fns.plugins.list({}).filter(p => p.domains.some((rule: string) => {
        const wildcard = rule.startsWith('*.');
        const base = (wildcard ? rule.slice(2) : rule).toLowerCase();
        return valid(base) && (wildcard ? host !== base && host.endsWith('.' + base) : host === base);
    })).map(p => ({ name: p.name, description: String(p.description ?? '').slice(0, 360), domains: p.domains }));
}
