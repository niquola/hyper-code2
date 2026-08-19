type TypeTarget =
    | { ref: string; css?: never; text?: never; exact?: never }
    | { css: string; ref?: never; text?: never; exact?: never }
    | { text: string; exact?: boolean; ref?: never; css?: never };

/**
 * Types text through trusted CDP keyboard input after focusing a target.
 *
 * Use this for autocomplete, rich editors and applications that react to real
 * keyboard events. Set `clear` to select and delete existing content first.
 * For plain form replacement without key-by-key events, prefer browser.fill.
 *
 * @param opts.target Editable element identified by snapshot ref, strict CSS, or strict text.
 * @param opts.text Text to type through Chrome input events.
 * @param opts.clear Select and delete existing content before typing. @default false
 * @param opts.delayMs Delay between typed characters. @default 0 @minimum 0 @maximum 1000
 * @param opts.session Logical browser session containing the field. @default main
 * @param opts.timeoutMs Maximum wait for the target to become editable. @default 5000 @minimum 100 @maximum 60000
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Editable element identified by snapshot ref, strict CSS, or strict text. */
        target: TypeTarget;
        /** Text to type through Chrome input events. */
        text: string;
        /** Select and delete existing content before typing. @default false */
        clear?: boolean;
        /** Delay between typed characters. @default 0 @minimum 0 @maximum 1000 */
        delayMs?: number;
        /** Logical browser session containing the field. @default main */
        session?: string;
        /** Maximum wait for the target to become editable. @default 5000 @minimum 100 @maximum 60000 */
        timeoutMs?: number;
    },
): Promise<{ typed: number; value: string }> {
    const session = String(opts.session || "main");
    const delayMs = Math.max(0, Math.min(Number(opts.delayMs ?? 0), 1_000));
    if (opts.clear) {
        await ctx.fns.browser.press({ session, target: opts.target, key: process.platform === "darwin" ? "Meta+a" : "Control+a", timeoutMs: opts.timeoutMs });
        await ctx.fns.browser.press({ session, key: "Backspace", timeoutMs: opts.timeoutMs });
    } else {
        await ctx.fns.browser.press({ session, target: opts.target, key: "ArrowRight", timeoutMs: opts.timeoutMs });
    }
    const characters = Array.from(String(opts.text ?? ""));
    for (const character of characters) {
        await ctx.fns.cdp.send({ session, method: "Input.insertText", params: { text: character } });
        if (delayMs) await Bun.sleep(delayMs);
    }
    const value = String(await ctx.fns.browser.evaluate({
        session,
        expression: `(document.activeElement?.isContentEditable ? document.activeElement.textContent : document.activeElement?.value ?? "")`,
    }) ?? "");
    return { typed: characters.length, value };
}
