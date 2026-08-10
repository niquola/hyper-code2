// Visible text of the driven page or one element. Default to #main, not body:
// the workspace body also contains the chat transcript, which is not the page
// being tested.
export default function (ctx: Context, _session: Session | null, opts: { selector?: string } = {}) {
    const sel = JSON.stringify(opts.selector ?? "#main");
    return ctx.fns.screen.eval({ code: `return document.querySelector(${sel})?.innerText ?? null` });
}
