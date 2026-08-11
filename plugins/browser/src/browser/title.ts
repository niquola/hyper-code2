export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { session?: string } = {},
): Promise<string> {
    return String(await ctx.fns.browser.evaluate({
        session: opts.session,
        expression: "document.title",
    }) ?? "");
}
