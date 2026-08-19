type ScrollTarget =
    | { ref: string; css?: never; text?: never; exact?: never }
    | { css: string; ref?: never; text?: never; exact?: never }
    | { text: string; exact?: boolean; ref?: never; css?: never };

/**
 * Scrolls the page or brings one target into view and scrolls its container.
 *
 * Without target, `dx` and `dy` scroll the window. With target, the element is
 * first centered in the viewport and optional deltas are applied to it.
 *
 * @param opts.target Optional element identified by snapshot ref, strict CSS, or strict text.
 * @param opts.dx Horizontal scroll delta in CSS pixels. @default 0
 * @param opts.dy Vertical scroll delta in CSS pixels. @default 0
 * @param opts.session Logical browser session whose page is scrolled. @default main
 * @param opts.timeoutMs Maximum wait for the optional target. @default 5000 @minimum 100 @maximum 60000
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Optional element identified by snapshot ref, strict CSS, or strict text. */
        target?: ScrollTarget;
        /** Horizontal scroll delta in CSS pixels. @default 0 */
        dx?: number;
        /** Vertical scroll delta in CSS pixels. @default 0 */
        dy?: number;
        /** Logical browser session whose page is scrolled. @default main */
        session?: string;
        /** Maximum wait for the optional target. @default 5000 @minimum 100 @maximum 60000 */
        timeoutMs?: number;
    } = {},
): Promise<{ x: number; y: number }> {
    const result = await ctx.fns.browser.act({ session: opts.session, timeoutMs: opts.timeoutMs, actions: [{ kind: "scroll", target: opts.target, dx: opts.dx, dy: opts.dy }] });
    if (!result.ok) throw actionFailure("browser.scroll", result.failed);
    return (result.results[0]?.value as { x: number; y: number } | undefined) ?? { x: 0, y: 0 };
}

function actionFailure(name: string, failed: any): Error {
    const error = new Error(`${name}: ${failed?.code ?? "ACTION_FAILED"}: ${failed?.message ?? "action failed"}`);
    (error as any).code = failed?.code ?? "ACTION_FAILED";
    return error;
}
