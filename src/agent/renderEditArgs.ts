// Human-readable edit preview for the tool dialog. The JSON envelope is useful
// to a provider, not to a person: show each operation as a small diff card.
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { path?: string; edits?: types.tools.EditOp[] },
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
        cards.push(`<section class="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"><div class="mb-2 flex items-center gap-2"><span class="flex size-5 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-500">${index + 1}</span><span class="text-xs font-semibold text-gray-700">${esc(label)}</span><span class="ml-auto rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">${esc(location)}</span></div><div class="space-y-2">${blocks.join("") || `<div class="text-xs text-gray-400">No inline content</div>`}</div></section>`);
    }

    return `<div class="edit-preview"><div class="mb-3 flex items-center gap-2"><i class="ph ph-file-code text-gray-400"></i><span class="min-w-0 flex-1 truncate font-mono text-xs font-medium text-gray-700">${esc(path)}</span><span class="text-[10px] text-gray-400">${edits.length} change${edits.length === 1 ? "" : "s"}</span></div><div class="space-y-3">${cards.join("") || `<div class="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-400">No edits</div>`}</div></div>`;
}
