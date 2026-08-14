/**
 * Evaluates JavaScript in the current page.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
  /** JavaScript expression to evaluate. */
  expression: string;
  /** Logical browser session name. */
  session?: string;
  /** Whether to await a promise returned by the expression. */
  awaitPromise?: boolean },
): Promise<any> {
    const result = await ctx.fns.cdp.send({
        session: opts.session,
        method: "Runtime.evaluate",
        params: {
            expression: opts.expression,
            returnByValue: true,
            awaitPromise: opts.awaitPromise !== false,
        },
    });
    if (result?.exceptionDetails) {
        const detail = result.exceptionDetails.exception?.description || result.exceptionDetails.text || "page evaluation failed";
        throw new Error(detail);
    }
    return result?.result?.value;
}
