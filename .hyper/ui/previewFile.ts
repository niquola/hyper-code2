/**
 * Opens the full Files UI in a wide application popup without leaving the current agent.
 *
 * Use when the user asks to inspect or navigate files in a popup. The iframe uses the
 * canonical path-based Files URL, so relative Markdown links and media assets work, and
 * Files tabs such as Preview, Code, and Edit remain available.
 * @param opts.path Workspace-relative or absolute file or directory path to open.
 * @param opts.mode Initial file tab. Auto uses the Files UI default. @default auto
 * @param opts.title Optional popup title; defaults to the file path.
 * @param opts.maxChars Deprecated compatibility option; Files UI loads the complete file. @default 200000 @minimum 1 @maximum 1000000
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Workspace-relative or absolute file or directory path to open. */
        path: string;
        /** Initial file tab. Auto uses the Files UI default. @default auto */
        mode?: "auto" | "preview" | "source";
        /** Optional popup title; defaults to the file path. */
        title?: string;
        /** Deprecated compatibility option; Files UI loads the complete file. @default 200000 @minimum 1 @maximum 1000000 */
        maxChars?: number;
    },
): Promise<{ path: string; mode: "auto" | "preview" | "source"; url: string }> {
    const path = ctx.fns.files.resolveSafe({ path: opts.path });
    const info = await ctx.fns.files.stat({ path });
    if (!info) throw new Error(`file not found: ${opts.path}`);

    const mode = opts.mode ?? "auto";
    const baseUrl = (await ctx.fns.files.browserUrl({ path })).replace("/files/absolute/", "/files/embed/");
    const params = new URLSearchParams();
    if (mode === "preview") params.set("tab", "preview");
    if (mode === "source") params.set("tab", "code");
    const url = params.size ? `${baseUrl}?${params}` : baseUrl;
    const title = opts.title ?? path;
    const html = ctx.fns.ui.popupContent({
        title,
        kind: "file-preview",
        class: "h-full w-full",
        html: `<iframe src="${escapeAttribute(url)}" title="${escapeAttribute(title)}" class="block h-full w-full border-0 bg-base-200" loading="eager"></iframe>`,
    });

    await ctx.fns.ui.eval({ code: `(() => {
      const dialog = document.getElementById('app-popup');
      const body = document.getElementById('app-popup-body');
      if (!dialog || !body) return;
      dialog.style.width = 'min(90rem, calc(100vw - 2rem))';
      dialog.style.height = '97vh';
      dialog.style.maxHeight = '97vh';
      const shell = dialog.firstElementChild;
      if (shell) {
        shell.style.height = '100%';
        shell.style.maxHeight = '100%';
      }
      body.className = 'app-popup-body min-h-0 flex-1 overflow-hidden bg-base-200 p-0';
      body.innerHTML = ${JSON.stringify(html)};
      window.hyperPopup?.open(${JSON.stringify(title)}, 'file-preview');
      dialog.addEventListener('close', () => {
        dialog.style.removeProperty('width');
        dialog.style.removeProperty('height');
        dialog.style.removeProperty('max-height');
        if (shell) {
          shell.style.removeProperty('height');
          shell.style.removeProperty('max-height');
        }
        body.className = 'app-popup-body min-h-0 flex-1 overflow-auto bg-base-200/60 p-5 text-xs text-base-content/70';
      }, { once: true });
    })()` });
    return { path, mode, url };
}

function escapeAttribute(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
