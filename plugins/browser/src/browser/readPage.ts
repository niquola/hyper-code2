// Read one page in a background Chrome session as compact structured text.
/**
 * Navigates to a URL and returns cleaned page content.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
  /** Absolute URL to read. */
  url: string;
  /** Logical browser session name. */
  session?: string;
  /** Maximum number of page characters to return. */
  maxChars?: number;
  /** Additional delay after navigation in milliseconds. */
  settleMs?: number },
) {
    const url = String(opts.url ?? "").trim();
    if (!/^https?:\/\//i.test(url)) throw new Error("browser.readPage: absolute http(s) url is required");
    const session = opts.session || "read-page";
    await ctx.fns.browser.navigate({ session, url, settleMs: opts.settleMs ?? 900 });
    return await ctx.fns.browser.evaluate({ session, expression: `(() => {
      const root = document.querySelector("article,main,[role=main]") || document.body;
      const clone = root.cloneNode(true);
      clone.querySelectorAll("script,style,noscript,nav,footer,header,aside,form,button,svg").forEach(x => x.remove());
      const text = (clone.innerText || clone.textContent || "").replace(/\\n{3,}/g, "\\n\\n").trim();
      return { title: document.title, url: location.href, text: text.slice(0, ${Math.max(500, Math.min(Number(opts.maxChars ?? 12_000), 50_000))}), truncated: text.length > ${Math.max(500, Math.min(Number(opts.maxChars ?? 12_000), 50_000))} };
    })()` });
}
