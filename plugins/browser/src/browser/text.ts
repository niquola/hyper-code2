/**
 * Extracts visible text from the page or a selected element.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
  /** Logical browser session name. */
  session?: string;
  /** Optional CSS selector limiting text extraction. */
  selector?: string } = {},
): Promise<string> {
    const selector = opts.selector ? JSON.stringify(opts.selector) : null;
    const expression = selector
        ? `(() => { const el = document.querySelector(${selector}); if (!el) throw new Error("selector not found: " + ${selector}); return (el.innerText || el.textContent || "").trim(); })()`
        : `(document.body?.innerText || document.documentElement?.innerText || "").trim()`;
    return String(await ctx.fns.browser.evaluate({ session: opts.session, expression }) ?? "");
}
