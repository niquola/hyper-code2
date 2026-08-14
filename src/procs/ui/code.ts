// Syntax-highlighted code, on the server — Shiki, no browser highlighter. The
// highlighter is built once per process and cached; unlike the chat's (which
// renders plain until it warms, because that path is sync), this one is awaited,
// so a component always gets highlighted output.
import { createHighlighter } from "shiki";

const THEME = "github-light";
const LANGS = ["typescript", "tsx", "json", "css", "html", "bash", "shellscript"];
const ALIASES: Record<string, string> = { ts: "typescript", js: "typescript", jsx: "tsx", sh: "shellscript", bash: "shellscript", jsonc: "json" };

/**
 * Perform code for the ui subsystem.
 * @param opts.code The code to process.
 * @param opts.lang The lang value used by the operation.
 * @param opts.class CSS classes to apply.
 */
export default async function (ctx: Context, _session: Session | null, opts: {code: string; lang?: string; class?: string }): Promise<string> {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const hl = await highlighter(ctx);
    const lang = ALIASES[(opts.lang ?? "typescript").toLowerCase()] ?? (opts.lang ?? "typescript").toLowerCase();
    const inner = hl && (hl.getLoadedLanguages() as string[]).includes(lang)
        ? hl.codeToHtml(opts.code, { lang, theme: THEME })
        : `<pre class="shiki"><code>${esc(opts.code)}</code></pre>`;
    return `<div class="ui-code overflow-x-auto rounded-md border border-base-300 text-xs ${opts.class ?? ""}" ${ctx.fns.procs.ui.attr({ role: "code" })}>${inner}</div>`;
}

function highlighter(ctx: Context): Promise<any> {
    const slot = (ctx.state.uiShiki ??= {});
    return slot.building ??= createHighlighter({ themes: [THEME], langs: LANGS }).catch((error: any) => {
        ctx.fns.procs.log.warn({ event: "ui.code.shiki", msg: String(error?.message ?? error) });
        delete slot.building;
        return null;
    });
}
