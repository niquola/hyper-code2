// Base layer for the arXiv public API (no auth). Rate-limited GET to the Atom
// query endpoint + inline Atom-feed parser. arXiv ToU: <=1 request / 3s and a
// descriptive User-Agent; we track the last request ts in ctx.state.arxiv.
// ctx.fns.arxiv.api({ params: { search_query: "all:fhir", max_results: "3" } })
// → { papers: [{ id, versionedId, title, summary, link, authors, published, updated, categories }], meta, error }
const API_BASE = "https://export.arxiv.org/api/query";
const RATE_DELAY_MS = 3000;
const UA = "hyper-code2-arxiv/1.0 (+local research client)";

function decodeEntities(s: string): string {
    return s
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&");
}
function norm(s: string): string {
    return decodeEntities(s).replace(/\s+/g, " ").trim();
}
function tag(xml: string, name: string): string {
    const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i").exec(xml);
    return m ? norm(m[1]!) : "";
}
function tags(xml: string, name: string): string[] {
    const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "gi");
    const out: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) out.push(norm(m[1]!));
    return out;
}
function altLink(entry: string): string {
    const re = /<link\b([^>]*?)\/?>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(entry)) !== null) {
        const attrs = m[1] || "";
        if (/\brel="alternate"/i.test(attrs)) {
            const href = /\bhref="([^"]+)"/i.exec(attrs);
            return href ? decodeEntities(href[1]!) : "";
        }
    }
    return "";
}
function pdfLink(entry: string): string {
    const re = /<link\b([^>]*?)\/?>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(entry)) !== null) {
        const attrs = m[1] || "";
        if (/\btitle="pdf"/i.test(attrs)) {
            const href = /\bhref="([^"]+)"/i.exec(attrs);
            return href ? decodeEntities(href[1]!) : "";
        }
    }
    return "";
}
function categories(entry: string): string[] {
    const re = /<category\b([^>]*?)\/?>/gi;
    const out: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(entry)) !== null) {
        const term = /\bterm="([^"]+)"/i.exec(m[1] || "");
        if (term?.[1]) out.push(term[1]);
    }
    return out;
}
function idsFromEntryId(entryId: string): { paperId: string; versionedId: string } {
    const versionedId = entryId.replace(/^https?:\/\/arxiv\.org\/abs\//, "") || entryId;
    return { paperId: versionedId.replace(/v\d+$/, ""), versionedId };
}

export default async function (ctx: Context, session: Session | null, opts: { params: Record<string, string> }) {
    const cache = ((ctx.state as any).arxiv ??= { lastRequestTs: 0 });
    const wait = Math.max(0, RATE_DELAY_MS - (Date.now() - cache.lastRequestTs));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));

    const qp = new URLSearchParams(opts.params);
    const url = `${API_BASE}?${qp.toString()}`;
    const res = await fetch(url, { headers: { "user-agent": UA } });
    cache.lastRequestTs = Date.now();
    const xml = await res.text();
    if (!res.ok) throw new Error(`arXiv API ${res.status}: ${xml.slice(0, 300)}`);
    if (!xml.includes("<feed")) throw new Error(`arXiv API ${res.status}: non-feed response: ${xml.slice(0, 300)}`);

    const papers: any[] = [];
    const entryRe = /<entry>([\s\S]*?)<\/entry>/gi;
    let em: RegExpExecArray | null;
    while ((em = entryRe.exec(xml)) !== null) {
        const e = em[1]!;
        const rawId = tag(e, "id");
        const ids = idsFromEntryId(rawId);
        papers.push({
            id: ids.paperId,
            versionedId: ids.versionedId,
            entryId: rawId,
            title: tag(e, "title"),
            summary: tag(e, "summary"),
            link: altLink(e),
            pdf: pdfLink(e),
            authors: tags(e, "name"),
            published: tag(e, "published"),
            updated: tag(e, "updated"),
            categories: categories(e),
        });
    }

    let error: string | null = null;
    if (papers.length === 1 && papers[0].title.toLowerCase() === "error") {
        error = papers[0].summary || "arXiv API returned an error entry";
    }

    const num = (v: string) => (v ? Number.parseInt(v, 10) : null);
    return {
        papers: error ? [] : papers,
        error,
        meta: {
            totalResults: num(tag(xml, "opensearch:totalResults")),
            startIndex: num(tag(xml, "opensearch:startIndex")),
            itemsPerPage: num(tag(xml, "opensearch:itemsPerPage")),
            updated: tag(xml, "updated"),
        },
    };
}
