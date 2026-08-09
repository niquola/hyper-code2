// The default HTML shell, so that a handler returning a string or `{ main }`
// produces a page before an app has written a layout of its own. It carries the
// three things every proc page needs — the compiled stylesheets, htmx, and the
// event stream — and one `#main` for htmx to swap into.
//
// **Apps are expected to replace this.** A root `$name.ts` in the app's own src
// overrides the framework's (the app root is scanned last), which is how the
// workspace gets its chat column and the EHR its clinical nav. Overriding it is
// the normal case; this exists so that not overriding it still works.
export default function (ctx: Context, _session: Session | null, opts: {title?: string; main: string; headExtra?: string }): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title ?? "procs")}</title>
<script src="/procs/ui/htmx.js" defer></script>
<script src="/procs/ui/combobox.js" defer></script>
${(ctx.state.procs?.styles ?? []).map((s: any) => `<link data-css rel="stylesheet" href="${esc(s.href)}">`).join("\n")}
${[...new Set((ctx.state.procs?.modules ?? []).flatMap((m: any) => m.clients ?? []))].map((src: any) => `<script src="${esc(src)}" defer></script>`).join("\n")}
${opts.headExtra ?? ""}
</head>
<body class="min-h-screen bg-base-200 text-base-content text-sm">
<main id="main" class="p-6">${opts.main}</main>
</body>
</html>`;
}
