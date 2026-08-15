// Human-readable edit preview for the tool dialog. The JSON envelope is useful
// to a provider, not to a person: show each operation as a small diff card.
/** Render edit args for the runtime.  * @param opts.path File path to read or render.
 * @param opts.edits File edit operations to render.
*/
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Path to the target resource. */
    path?: string;
        /** Edits used by the operation. */
    edits?: types.tools.EditOp[] },
): Promise<string> {
    const esc = (value: any) => ctx.fns.procs.ui.escape({ text: String(value ?? "") });
    const path = String(opts.path ?? "");
    const lang = ctx.fns.agent.toolLang({ name: "read", args: { path }, part: "result" });
    const edits = Array.isArray(opts.edits) ? opts.edits : [];

    const code = async (text: any, tone: "remove" | "add") => {
        const html = await ctx.fns.markdown.highlight({ code: String(text ?? ""), lang });
        const cls = tone === "remove"
            ? "border-red-200 bg-red-50/70 edit-remove"
            : "border-emerald-200 bg-emerald-50/70 edit-add";
        const sign = tone === "remove" ? "−" : "+";
        return `<div class="relative overflow-hidden rounded-lg border ${cls}"><span class="absolute left-2 top-1.5 z-10 font-mono text-xs font-bold ${tone === "remove" ? "text-red-500" : "text-emerald-600"}">${sign}</span><div class="pl-5">${html}</div></div>`;
    };

    const cards: string[] = [];
    for (let index = 0; index < edits.length; index++) {
        const edit = edits[index]!;
        const op = edit.op ?? (edit.oldText != null ? "replace" : "edit");
        const location = edit.anchor
            ? `@${edit.anchor}${edit.endAnchor ? ` … @${edit.endAnchor}` : ""}`
            : edit.all ? "all matches" : "one match";
        const label = op === "replace" ? "Replace"
            : op === "replaceLines" ? "Replace lines"
            : op === "insertBefore" ? "Insert before"
            : op === "insertAfter" ? "Insert after"
            : op === "delete" ? "Delete"
            : op;
        const blocks: string[] = [];
        if (edit.oldText != null) blocks.push(await code(edit.oldText, "remove"));
        if (edit.newText != null && edit.newText !== "") blocks.push(await code(edit.newText, "add"));
        if ((op === "replaceLines" || op === "insertBefore" || op === "insertAfter") && edit.text != null) blocks.push(await code(edit.text, "add"));
        if (op === "delete" && edit.anchor) blocks.push(`<div class="rounded-lg border border-red-200 bg-red-50/70 px-3 py-2 text-xs text-red-700">Delete selected line${edit.endAnchor ? " range" : ""}</div>`);
        cards.push(`<section class="rounded-xl border border-base-300 bg-base-100 p-3 shadow-sm"><div class="mb-2 flex items-center gap-2"><span class="flex size-5 items-center justify-center rounded-full bg-base-200 text-[10px] font-semibold text-base-content/50">${index + 1}</span><span class="text-xs font-semibold text-base-content/70">${esc(label)}</span><span class="ml-auto rounded-md bg-base-200 px-1.5 py-0.5 font-mono text-[10px] text-base-content/50">${esc(location)}</span></div><div class="space-y-2">${blocks.join("") || `<div class="text-xs text-base-content/40">No inline content</div>`}</div></section>`);
    }

    return `<div class="edit-preview"><div class="mb-3 flex items-center gap-2"><i class="ph ph-file-code text-base-content/40"></i><span class="min-w-0 flex-1 truncate font-mono text-xs font-medium text-base-content/70">${esc(path)}</span><span class="text-[10px] text-base-content/40">${edits.length} change${edits.length === 1 ? "" : "s"}</span></div><div class="space-y-3">${cards.join("") || `<div class="rounded-lg border border-base-300 bg-base-100 p-3 text-xs text-base-content/40">No edits</div>`}</div></div>`;
}
