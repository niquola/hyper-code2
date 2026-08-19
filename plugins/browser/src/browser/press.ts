type PressTarget =
    | { ref: string; css?: never; text?: never; exact?: never }
    | { css: string; ref?: never; text?: never; exact?: never }
    | { text: string; exact?: boolean; ref?: never; css?: never };

/**
 * Sends one keyboard key or modifier combination to the page or a target.
 *
 * When target is present the element is focused first. Use key names such as
 * `Enter`, `Tab`, `Escape`, `ArrowDown`, or combinations such as `Control+a`.
 *
 * @param opts.key Key name or modifier combination to dispatch.
 * @param opts.target Optional element to focus before dispatching the key.
 * @param opts.session Logical browser session whose page receives the key. @default main
 * @param opts.timeoutMs Maximum wait for the optional target. @default 5000 @minimum 100 @maximum 60000
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Key name or modifier combination to dispatch. */
        key: string;
        /** Optional element to focus before dispatching the key. */
        target?: PressTarget;
        /** Logical browser session whose page receives the key. @default main */
        session?: string;
        /** Maximum wait for the optional target. @default 5000 @minimum 100 @maximum 60000 */
        timeoutMs?: number;
    },
): Promise<{ key: string }> {
    const key = String(opts.key ?? "").trim();
    if (!key) throw new TypeError("browser.press: key is required");
    const result = await ctx.fns.browser.act({
        session: opts.session,
        timeoutMs: opts.timeoutMs,
        actions: [{ kind: "press", key, target: opts.target }],
    });
    if (!result.ok) throw actionFailure("browser.press", result.failed);
    return { key };
}

function actionFailure(name: string, failed: any): Error {
    const error = new Error(`${name}: ${failed?.code ?? "ACTION_FAILED"}: ${failed?.message ?? "action failed"}`);
    (error as any).code = failed?.code ?? "ACTION_FAILED";
    return error;
}
