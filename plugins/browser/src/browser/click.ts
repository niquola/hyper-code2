export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { selector: string; session?: string },
): Promise<boolean> {
    const selector = JSON.stringify(opts.selector);
    return !!await ctx.fns.browser.evaluate({
        session: opts.session,
        expression: `(() => { const el = document.querySelector(${selector}); if (!el) throw new Error("selector not found: " + ${selector}); el.scrollIntoView({ block: "center" }); el.click(); return true; })()`,
    });
}
