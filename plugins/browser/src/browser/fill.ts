type FillTarget =
    | { ref: string; css?: never; text?: never; exact?: never }
    | { css: string; ref?: never; text?: never; exact?: never }
    | { text: string; exact?: boolean; ref?: never; css?: never };

/**
 * Replaces text in one or more form fields sequentially without submitting.
 *
 * Use a single field for ordinary input or batch the fields of one form to
 * reduce tool calls. Execution is fail-fast and returns completed field results
 * if a later field fails. This function never submits the form.
 *
 * @param opts.fields Ordered non-empty fields to fill; each target must use exactly one ref, CSS, or text locator. @minimum 1 @maximum 50
 * @param opts.session Logical browser session whose form is filled. @default main
 * @param opts.timeoutMs Maximum wait for each field to become editable. @default 5000 @minimum 100 @maximum 60000
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Ordered non-empty fields to fill; each target must use exactly one ref, CSS, or text locator. @minimum 1 @maximum 50 */
        fields: Array<{ target: FillTarget; value: string }>;
        /** Logical browser session whose form is filled. @default main */
        session?: string;
        /** Maximum wait for each field to become editable. @default 5000 @minimum 100 @maximum 60000 */
        timeoutMs?: number;
    },
): Promise<{ filled: number; results: Array<{ index: number; value?: unknown }> }> {
    if (!Array.isArray(opts.fields) || opts.fields.length === 0) throw new TypeError("browser.fill: fields must be a non-empty array");
    const result = await ctx.fns.browser.act({
        session: opts.session,
        timeoutMs: opts.timeoutMs,
        actions: opts.fields.map(field => ({ kind: "fill" as const, target: field.target, value: String(field.value ?? "") })),
    });
    if (!result.ok) throw actionFailure("browser.fill", result);
    return { filled: result.completed, results: result.results.map(item => ({ index: item.index, value: item.value })) };
}

function actionFailure(name: string, result: any): Error {
    const failed = result.failed;
    const error = new Error(`${name}: ${failed?.code ?? "ACTION_FAILED"}: ${failed?.message ?? "action failed"}; completed=${result.completed ?? 0}`);
    Object.assign(error, { code: failed?.code ?? "ACTION_FAILED", completed: result.completed ?? 0, results: result.results ?? [] });
    return error;
}
