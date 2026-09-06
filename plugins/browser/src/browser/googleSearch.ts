// Search Google in a named background tab and return compact organic results.
// Uses the user's real Chrome session, so regional settings and existing consent
// state are preserved. Selectors deliberately anchor on result h3 elements and
// discover the enclosing snippet instead of depending on one brittle container.
/**
 * Runs a Google web search and returns structured results.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
  /** Search query. */
  query: string;
  /** Maximum number of results to return. */
  count?: number;
  /** Logical browser session name. */
  session?: string;
  /** Google interface language code. */
  language?: string;
  /** Whether to leave the search tab open. */
  keepOpen?: boolean },
) {
    const query = String(opts.query ?? "").trim();
    if (!query) throw new Error("browser.googleSearch: query is required");
    const count = Math.max(1, Math.min(Number(opts.count ?? 8), 20));
    const scope = await ctx.fns.cdp.scope({ session: opts.session });
    const session = scope.session || "google-search";
    const language = String(opts.language || "en").replace(/[^a-z-]/gi, "");
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=${encodeURIComponent(language)}`;
    try {
        await ctx.fns.browser.navigate({ session, url, settleMs: 1200 });

        const state = await ctx.fns.browser.evaluate({
            session,
        expression: `(() => {
          const body = document.body?.innerText || "";
          const blocked = /unusual traffic|not a robot|detected unusual|before you continue/i.test(body);
          const results = [...document.querySelectorAll("a h3")].map(h => {
            const a = h.closest("a");
            if (!a || !/^https?:/.test(a.href)) return null;
            let box = h;
            for (let i = 0; i < 8 && box && !box.querySelector?.(".VwiC3b,[data-sncf]"); i++) box = box.parentElement;
            const snippet = box?.querySelector?.(".VwiC3b,[data-sncf]")?.innerText || "";
            return { title: (h.innerText || "").trim(), url: a.href, snippet: snippet.trim() };
          }).filter(Boolean);
          return { title: document.title, blocked, results };
        })()`,
    });
        if (state?.blocked) throw new Error("browser.googleSearch: Google requires consent or CAPTCHA in the Chrome tab");

        const seen = new Set<string>();
        const results = (state?.results ?? []).filter((item: any) => {
            if (!item.title || !item.url || seen.has(item.url)) return false;
            seen.add(item.url);
            return true;
        }).slice(0, count);
        return { query, url, title: state?.title ?? "", results };
    } finally {
        if (!opts.keepOpen) await ctx.fns.browser.tabClose({ session }).catch(() => {});
    }
}
