type ClickTarget =
    | { ref: string; css?: never; text?: never; exact?: never }
    | { css: string; ref?: never; text?: never; exact?: never }
    | { text: string; exact?: boolean; ref?: never; css?: never };

/**
 * Clicks one strict browser target after waiting for it to become actionable.
 *
 * Prefer a revision-scoped `target.ref` from browser.snapshot. `target.css` and
 * `target.text` are strict fallbacks: multiple matches fail instead of silently
 * clicking the first. The legacy `selector` option remains supported and maps
 * to `target.css`, preserving the existing boolean return contract.
 *
 * @param opts.target Structured ref, CSS, or visible-text target. Exactly one locator field is required when selector is absent.
 * @param opts.selector Legacy CSS selector retained for backward compatibility.
 * @param opts.session Logical browser session whose page receives the click. @default main
 * @param opts.button Mouse button used for the click. @default left
 * @param opts.count Number of clicks, where 2 is a double-click. @default 1 @minimum 1 @maximum 3
 * @param opts.timeoutMs Maximum wait for target actionability. @default 5000 @minimum 100 @maximum 60000
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Structured ref, CSS, or visible-text target. Exactly one locator field is required when selector is absent. */
        target?: ClickTarget;
        /** Legacy CSS selector retained for backward compatibility. */
        selector?: string;
        /** Logical browser session whose page receives the click. @default main */
        session?: string;
        /** Mouse button used for the click. @default left */
        button?: "left" | "middle" | "right";
        /** Number of clicks, where 2 is a double-click. @default 1 @minimum 1 @maximum 3 */
        count?: number;
        /** Maximum wait for target actionability. @default 5000 @minimum 100 @maximum 60000 */
        timeoutMs?: number;
    },
): Promise<boolean> {
    if (opts.target && opts.selector) throw new TypeError("browser.click: pass target or selector, not both");
    const target = opts.target ?? (opts.selector ? { css: opts.selector } : null);
    if (!target) throw new TypeError("browser.click: target or selector is required");
    const result = await ctx.fns.browser.act({
        session: opts.session,
        timeoutMs: opts.timeoutMs,
        actions: [{ kind: "click", target, button: opts.button, count: opts.count }],
    });
    if (!result.ok) throw actionFailure("browser.click", result.failed);
    return true;
}

function actionFailure(name: string, failed: any): Error {
    const error = new Error(`${name}: ${failed?.code ?? "ACTION_FAILED"}: ${failed?.message ?? "action failed"}`);
    (error as any).code = failed?.code ?? "ACTION_FAILED";
    return error;
}
