// Somebody else's page, framed edge to edge in the pane — a preview, an external
// app. The app draws its own chrome, so this adds none.
export default function (ctx: Context, _session: Session | null, opts: {url: string; title?: string; class?: string }): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    return `<iframe src="${esc(opts.url)}" title="${esc(opts.title ?? "")}" class="block h-[calc(100vh-3rem)] w-[calc(100%+3rem)] -m-6 bg-base-100 ${opts.class ?? ""}" ${ctx.fns.procs.ui.attr({ role: "frame" })}></iframe>`;
}
