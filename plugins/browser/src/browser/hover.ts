type HoverTarget =
    | { ref: string; css?: never; text?: never; exact?: never }
    | { css: string; ref?: never; text?: never; exact?: never }
    | { text: string; exact?: boolean; ref?: never; css?: never };

/**
 * Moves the mouse to the center of one actionable browser target.
 *
 * @param opts.target Element identified by snapshot ref, strict CSS, or strict text.
 * @param opts.session Logical browser session whose mouse is moved. @default main
 * @param opts.timeoutMs Maximum wait for target actionability. @default 5000 @minimum 100 @maximum 60000
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Element identified by snapshot ref, strict CSS, or strict text. */
        target: HoverTarget;
        /** Logical browser session whose mouse is moved. @default main */
        session?: string;
        /** Maximum wait for target actionability. @default 5000 @minimum 100 @maximum 60000 */
        timeoutMs?: number;
    },
): Promise<{ hovered: boolean; x: number; y: number }> {
    const result = await ctx.fns.browser.act({ session: opts.session, timeoutMs: opts.timeoutMs, actions: [{ kind: "hover", target: opts.target }] });
    if (!result.ok) throw actionFailure("browser.hover", result.failed);
    return (result.results[0]?.value as { hovered: boolean; x: number; y: number } | undefined) ?? { hovered: true, x: 0, y: 0 };
}

function actionFailure(name: string, failed: any): Error {
    const error = new Error(`${name}: ${failed?.code ?? "ACTION_FAILED"}: ${failed?.message ?? "action failed"}`);
    (error as any).code = failed?.code ?? "ACTION_FAILED";
    return error;
}
