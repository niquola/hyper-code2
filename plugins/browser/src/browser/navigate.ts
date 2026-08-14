/**
 * Navigates a browser session to a URL.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
  /** Absolute URL to open. */
  url: string;
  /** Logical browser session name. */
  session?: string;
  /** Additional delay after navigation in milliseconds. */
  settleMs?: number },
): Promise<string> {
    const url = String(opts.url || "").trim();
    if (!/^https?:\/\//i.test(url) && !url.startsWith("about:")) throw new Error("navigate: url must be http(s) or about:");
    await ctx.fns.cdp.send({ session: opts.session, method: "Page.navigate", params: { url } });
    await Bun.sleep(opts.settleMs ?? 800);
    return String(await ctx.fns.browser.evaluate({ session: opts.session, expression: "location.href" }));
}
