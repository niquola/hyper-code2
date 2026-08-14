/**
 * Returns the title of the current page.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
  /** Logical browser session name. */
  session?: string } = {},
): Promise<string> {
    return String(await ctx.fns.browser.evaluate({
        session: opts.session,
        expression: "document.title",
    }) ?? "");
}
