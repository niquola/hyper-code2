// The `edit` tool's own argument check — the rules a JSON Schema cannot state.
//
// Declared as `validate: tools.editValidate` in $tool_edit.md and run by
// ctx.fns.tools.call once the schema passes. Returning complaints means the
// call never runs; returning nothing means go ahead.
//
// Why a function and not more schema: "these fields go together and those
// don't" is a oneOf, which strict decoding does not accept, and "oldText must
// not be empty" is not expressible at all. Better to say it in the one place
// that can say it precisely, in words the model can act on.
/** Validates semantic constraints for edit operations. */
export default function (
    _ctx: Context,
    _session: Session | null,
    opts: { /** Command-line arguments. */ args: { path?: string; edits?: types.tools.EditOp[] } },
): string[] {
    const edits = opts.args?.edits ?? [];
    const errors: string[] = [];

    if (!edits.length) return ["`edits` is empty — nothing to do"];

    const anchored = ["replaceLines", "insertBefore", "insertAfter", "delete"];
    let literal = 0;
    let anchoredCount = 0;

    edits.forEach((e, i) => {
        const op = e.op ?? (e.oldText != null ? "replace" : undefined);
        if (!op) {
            errors.push(`edits[${i}] needs either oldText/newText, or op with an anchor`);
            return;
        }

        if (op === "replace") {
            literal++;
            if (!e.oldText) errors.push(`edits[${i}].oldText is empty — it must be the exact text to replace`);
            if (e.newText === undefined) errors.push(`edits[${i}].newText is missing — use "" to delete the text`);
            if (e.oldText === e.newText) errors.push(`edits[${i}] replaces text with itself`);
            if (e.anchor) errors.push(`edits[${i}] mixes oldText with anchor — pick one`);
            return;
        }

        if (anchored.includes(op)) {
            anchoredCount++;
            if (!e.anchor) errors.push(`edits[${i}].anchor is required for ${op} — read the file with hashline first`);
            if ((op === "replaceLines" || op === "insertBefore" || op === "insertAfter") && e.text === undefined) {
                errors.push(`edits[${i}].text is required for ${op}`);
            }
        }
    });

    // The engine refuses the mix too, but saying it here names the reason:
    // a literal replacement shifts every line after it, so any anchor taken
    // before it is stale by the time it is applied.
    if (literal && anchoredCount) {
        errors.push("one edit call is either literal replacements or anchored ops — a literal replacement invalidates the anchors");
    }

    return errors;
}
