type CheckTarget =
    | { ref: string; css?: never; text?: never; exact?: never }
    | { css: string; ref?: never; text?: never; exact?: never }
    | { text: string; exact?: boolean; ref?: never; css?: never };

/**
 * Sets a checkbox or radio to an explicit desired checked state.
 *
 * The operation is idempotent: an already-correct checkbox is not clicked.
 * Radios accept only `value: true`, because directly unchecking one is not a
 * meaningful native interaction.
 *
 * @param opts.target Checkbox or radio identified by snapshot ref, strict CSS, or strict text.
 * @param opts.value Desired checked state.
 * @param opts.session Logical browser session containing the control. @default main
 * @param opts.timeoutMs Maximum wait for the control to become actionable. @default 5000 @minimum 100 @maximum 60000
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Checkbox or radio identified by snapshot ref, strict CSS, or strict text. */
        target: CheckTarget;
        /** Desired checked state. */
        value: boolean;
        /** Logical browser session containing the control. @default main */
        session?: string;
        /** Maximum wait for the control to become actionable. @default 5000 @minimum 100 @maximum 60000 */
        timeoutMs?: number;
    },
): Promise<{ checked: boolean }> {
    if (typeof opts.value !== "boolean") throw new TypeError("browser.check: value must be boolean");
    const result = await ctx.fns.browser.act({ session: opts.session, timeoutMs: opts.timeoutMs, actions: [{ kind: "check", target: opts.target, value: opts.value }] });
    if (!result.ok) throw actionFailure("browser.check", result.failed);
    return (result.results[0]?.value as { checked: boolean } | undefined) ?? { checked: opts.value };
}

function actionFailure(name: string, failed: any): Error {
    const error = new Error(`${name}: ${failed?.code ?? "ACTION_FAILED"}: ${failed?.message ?? "action failed"}`);
    (error as any).code = failed?.code ?? "ACTION_FAILED";
    return error;
}
