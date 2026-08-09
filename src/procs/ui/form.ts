// A form the workspace can fill and submit: it carries `data-form`, so
// `page.fill({ form })` and `page.submit({ form })` find it and `page.state`
// lists its fields. `post`/`get` are the htmx wiring; the pane is the target
// unless something narrower is given.
export default function (ctx: Context, _session: Session | null, opts: {
    form: string; body: string; post?: string; get?: string;
    target?: string; swap?: string; pushUrl?: boolean; trigger?: string; class?: string;
}): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const hx = opts.post ? `hx-post="${esc(opts.post)}"` : opts.get ? `hx-get="${esc(opts.get)}"` : "";
    return `<form class="${opts.class ?? "flex items-center gap-2"}" ${ctx.fns.procs.ui.attr({ form: opts.form })}
  ${hx} hx-target="${esc(opts.target ?? "#main")}" hx-swap="${esc(opts.swap ?? "innerHTML")}"${opts.pushUrl ? ` hx-push-url="true"` : ""}${opts.trigger ? ` hx-trigger="${esc(opts.trigger)}"` : ""}>
  ${opts.body}
</form>`;
}
