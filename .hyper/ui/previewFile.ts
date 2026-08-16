/**
 * Opens a workspace file in the application popup with syntax highlighting or rendered Markdown preview.
 *
 * Show document or source file in a wide popup without navigating away from the current agent. Use when the user asks to show a document, inspect a file, or preview Markdown; Markdown is rendered as sanitized HTML and source files are syntax highlighted.
 * @param opts.path Workspace-relative or absolute file path to preview.
 * @param opts.mode Rendering mode. Auto previews Markdown and highlights other files. @default auto
 * @param opts.title Optional popup title; defaults to the file path.
 * @param opts.maxChars Maximum file characters rendered in the popup. @default 200000 @minimum 1 @maximum 1000000
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Workspace-relative or absolute file path to preview. */
        path: string;
        /** Rendering mode. Auto previews Markdown and highlights other files. @default auto */
        mode?: "auto" | "preview" | "source";
        /** Optional popup title; defaults to the file path. */
        title?: string;
        /** Maximum file characters rendered in the popup. @default 200000 @minimum 1 @maximum 1000000 */
        maxChars?: number;
    },
): Promise<{ path: string; mode: "preview" | "source"; chars: number; truncated: boolean }> {
    const path = opts.path;
    const source = await ctx.fns.files.read({ path });
    const maxChars = Math.max(1, Math.min(opts.maxChars ?? 200000, 1000000));
    const truncated = source.length > maxChars;
    const visible = truncated ? source.slice(0, maxChars) : source;
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    const mode: "preview" | "source" = opts.mode === "source" ? "source" : opts.mode === "preview" ? "preview" : ext === "md" || ext === "markdown" ? "preview" : "source";
    const langByExt: Record<string, string> = { ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx", json: "json", md: "markdown", css: "css", html: "html", sql: "sql", sh: "bash", bash: "bash", py: "python", rs: "rust", go: "go", yaml: "yaml", yml: "yaml", toml: "toml" };
    let rendered = mode === "preview"
      ? await ctx.fns.markdown.render({ source: visible })
      : await ctx.fns.markdown.highlight({ code: visible, lang: langByExt[ext] ?? "text" });
    // The document title already lives in the popup header; avoid rendering it twice.
    if (mode === "preview") rendered = rendered.replace(/^\s*<h1>.*?<\/h1>\s*/s, "");
    const notice = truncated ? `<div class="mb-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">Preview truncated to ${maxChars.toLocaleString()} characters.</div>` : "";
    const previewCss = `<style>
      #app-popup[data-popup-kind="file-preview"] .app-popup-body { background: var(--color-base-100); padding: 1.75rem 2.25rem; }
      #app-popup[data-popup-kind="file-preview"] .markdown-body { color: color-mix(in srgb, currentColor 88%, transparent); font-size: .9375rem; line-height: 1.7; }
      #app-popup[data-popup-kind="file-preview"] .markdown-body > :first-child { margin-top: 0; }
      #app-popup[data-popup-kind="file-preview"] .markdown-body > :last-child { margin-bottom: 0; }
      #app-popup[data-popup-kind="file-preview"] .markdown-body h2 { margin: 2.25rem 0 .8rem; padding-bottom: .45rem; border-bottom: 1px solid var(--color-ui-border); font-size: 1.35rem; line-height: 1.3; font-weight: 700; color: var(--color-base-content); }
      #app-popup[data-popup-kind="file-preview"] .markdown-body h3 { margin: 1.75rem 0 .65rem; font-size: 1.08rem; line-height: 1.35; font-weight: 700; color: var(--color-base-content); }
      #app-popup[data-popup-kind="file-preview"] .markdown-body h4 { margin: 1.4rem 0 .5rem; font-size: .98rem; font-weight: 650; color: var(--color-base-content); }
      #app-popup[data-popup-kind="file-preview"] .markdown-body p { margin: .7rem 0; }
      #app-popup[data-popup-kind="file-preview"] .markdown-body ul, #app-popup[data-popup-kind="file-preview"] .markdown-body ol { margin: .75rem 0; padding-left: 1.6rem; }
      #app-popup[data-popup-kind="file-preview"] .markdown-body ul { list-style: disc; }
      #app-popup[data-popup-kind="file-preview"] .markdown-body ol { list-style: decimal; }
      #app-popup[data-popup-kind="file-preview"] .markdown-body li { margin: .3rem 0; padding-left: .2rem; }
      #app-popup[data-popup-kind="file-preview"] .markdown-body blockquote { margin: 1rem 0; padding: .65rem 1rem; border-left: 3px solid var(--color-primary); border-radius: 0 .5rem .5rem 0; background: color-mix(in srgb, var(--color-primary) 6%, transparent); }
      #app-popup[data-popup-kind="file-preview"] .markdown-body blockquote p { margin: 0; }
      #app-popup[data-popup-kind="file-preview"] .markdown-body hr { margin: 2.25rem 0; border: 0; border-top: 1px solid var(--color-ui-border); }
      #app-popup[data-popup-kind="file-preview"] .markdown-body code:not(pre code) { border-radius: .3rem; background: var(--color-base-200); padding: .12rem .32rem; font-size: .86em; }
      #app-popup[data-popup-kind="file-preview"] .markdown-body pre { margin: 1rem 0; overflow: auto; border: 1px solid var(--color-ui-border); border-radius: .65rem; padding: 1rem; }
      #app-popup[data-popup-kind="file-preview"] .markdown-body table { width: 100%; margin: 1rem 0; border-collapse: collapse; font-size: .875rem; }
      #app-popup[data-popup-kind="file-preview"] .markdown-body th, #app-popup[data-popup-kind="file-preview"] .markdown-body td { border: 1px solid var(--color-ui-border); padding: .55rem .7rem; text-align: left; vertical-align: top; }
      #app-popup[data-popup-kind="file-preview"] .markdown-body th { background: var(--color-base-200); font-weight: 650; }
      #app-popup[data-popup-kind="file-preview"] .markdown-body .mermaid-diagram { margin: 1.25rem 0; overflow-x: auto; border: 1px solid var(--color-ui-border); border-radius: .75rem; padding: 1rem; background: var(--color-base-100); }
      #app-popup[data-popup-kind="file-preview"] .markdown-body .mermaid-diagram svg { min-width: 42rem; max-width: none; }
      @media (max-width: 640px) { #app-popup[data-popup-kind="file-preview"] .app-popup-body { padding: 1.1rem; } }
    </style>`;
    const html = ctx.fns.ui.popupContent({
      title: opts.title ?? path,
      kind: "file-preview",
      class: "w-full",
      html: `${previewCss}${notice}<article class="markdown-body max-w-none overflow-auto" style="max-height:72vh">${rendered}</article>`
    });
    await ctx.fns.ui.eval({ code: `(() => { const dialog = document.getElementById('app-popup'); const body = document.getElementById('app-popup-body'); if (!body) return; if (dialog) { dialog.style.width = 'min(72rem, calc(100vw - 2rem))'; dialog.addEventListener('close', () => { dialog.style.removeProperty('width'); }, { once: true }); } body.innerHTML = ${JSON.stringify(html)}; window.hyperPopup?.open(${JSON.stringify(opts.title ?? path)}, 'file-preview'); })()` });
    return { path, mode, chars: source.length, truncated };
}
