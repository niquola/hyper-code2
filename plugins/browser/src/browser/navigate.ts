export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { url: string; session?: string; settleMs?: number },
): Promise<string> {
    const url = String(opts.url || "").trim();
    if (!/^https?:\/\//i.test(url) && !url.startsWith("about:")) throw new Error("navigate: url must be http(s) or about:");
    await ctx.fns.cdp.send({ session: opts.session, method: "Page.navigate", params: { url } });
    await Bun.sleep(opts.settleMs ?? 800);
    return String(await ctx.fns.browser.evaluate({ session: opts.session, expression: "location.href" }));
}
