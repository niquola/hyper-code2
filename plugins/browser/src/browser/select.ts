type SelectTarget =
    | { ref: string; css?: never; text?: never; exact?: never }
    | { css: string; ref?: never; text?: never; exact?: never }
    | { text: string; exact?: boolean; ref?: never; css?: never };

/**
 * Selects one or more values or visible labels in a native select element.
 *
 * Matching is exact against option values and trimmed visible labels. Missing
 * options and multiple values for a single-select fail explicitly.
 *
 * @param opts.target Select element identified by snapshot ref, strict CSS, or strict text.
 * @param opts.values Non-empty option values or visible labels to select. @minimum 1
 * @param opts.session Logical browser session containing the select. @default main
 * @param opts.timeoutMs Maximum wait for the select to become editable. @default 5000 @minimum 100 @maximum 60000
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Select element identified by snapshot ref, strict CSS, or strict text. */
        target: SelectTarget;
        /** Non-empty option values or visible labels to select. @minimum 1 */
        values: string[];
        /** Logical browser session containing the select. @default main */
        session?: string;
        /** Maximum wait for the select to become editable. @default 5000 @minimum 100 @maximum 60000 */
        timeoutMs?: number;
    },
): Promise<{ values: string[] }> {
    if (!Array.isArray(opts.values) || opts.values.length === 0) throw new TypeError("browser.select: values must be non-empty");
    const result = await ctx.fns.browser.act({ session: opts.session, timeoutMs: opts.timeoutMs, actions: [{ kind: "select", target: opts.target, values: opts.values.map(String) }] });
    if (!result.ok) throw actionFailure("browser.select", result.failed);
    return (result.results[0]?.value as { values: string[] } | undefined) ?? { values: [] };
}

function actionFailure(name: string, failed: any): Error {
    const error = new Error(`${name}: ${failed?.code ?? "ACTION_FAILED"}: ${failed?.message ?? "action failed"}`);
    (error as any).code = failed?.code ?? "ACTION_FAILED";
    return error;
}
