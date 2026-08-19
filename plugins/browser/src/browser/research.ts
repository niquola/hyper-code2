// Search Google, then read several result pages concurrently in independent
// background tabs. Returns evidence, not a synthesized answer — the calling
// agent compares sources and draws conclusions itself.
/**
 * Searches the web and reads a bounded set of result pages.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
  /** Research query. */
  query: string;
  /** Maximum number of result pages to read. */
  pages?: number;
  /** Maximum characters retained from each page. */
  maxCharsPerPage?: number;
  /** Base logical browser session name. */
  session?: string;
  /** Whether to leave research tabs open. */
  keepOpen?: boolean },
): Promise<{
    query: string;
    searchUrl: string;
    documents: Array<{
        title: string;
        url: string;
        snippet?: string;
        format?: "text";
        content?: string;
        text: string;
        truncated: boolean;
        error: string | null;
    }>;
}> {
    const pages = Math.max(1, Math.min(Number(opts.pages ?? 4), 8));
    const base = opts.session || "research";
    try {
        const search = await ctx.fns.browser.googleSearch({
            query: opts.query,
            count: Math.max(pages, 6),
            session: `${base}-search`,
            keepOpen: true,
        });
        const selected = search.results.slice(0, pages);
        const documents = await Promise.all(selected.map(async (result: any, index: number) => {
            const session = `${base}-page-${index + 1}`;
            try {
                await ctx.fns.browser.navigate({ session, url: result.url, settleMs: 900 });
                const page = await ctx.fns.browser.snapshot({
                    session,
                    mode: "text",
                    readable: true,
                    maxChars: opts.maxCharsPerPage ?? 10_000,
                    maxNodes: 2_000,
                    depth: 40,
                });
                return {
                    ...result,
                    title: page.title,
                    url: page.url,
                    format: "text" as const,
                    content: page.content,
                    text: page.content,
                    truncated: page.truncated,
                    error: null,
                };
            } catch (error: any) {
                return { ...result, text: "", truncated: false, error: String(error?.message ?? error) };
            } finally {
                if (!opts.keepOpen) await ctx.fns.browser.closeSessions({ sessions: [session] }).catch(() => {});
            }
        }));
        return { query: opts.query, searchUrl: search.url, documents };
    } finally {
        if (!opts.keepOpen) await ctx.fns.browser.closeSessions({ prefix: `${base}-` }).catch(() => {});
    }
}
