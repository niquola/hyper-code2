// Where you are in a sequence — a stepwise questionnaire, a wizard. Each step is
// done, current, or ahead, and reads its state from `data-status`. A `href`
// makes a done step a way back.
/**
 * Perform steps for the ui subsystem.
 * @param opts.steps The steps value used by the operation.
 * @param opts.current The current value used by the operation.
 * @param opts.class CSS classes to apply.
 */
export default function (ctx: Context, _session: Session | null, opts: {steps: Array<{ label: string; href?: string }>; current: number; class?: string }): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    // daisyUI's `steps`: the connector line and the numbered bubble are the
    // component's own, so a step is just an `li` that is or is not `step-primary`.
    return `<ul class="steps ${opts.class ?? ""}" ${ctx.fns.procs.ui.attr({ role: "steps" })}>
  ${opts.steps.map((s, i) => {
        const status = i < opts.current ? "done" : i === opts.current ? "current" : "todo";
        const inner = s.href && i < opts.current
            ? `<a href="${esc(s.href)}" hx-get="${esc(s.href)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true">${esc(s.label)}</a>`
            : esc(s.label);
        return `<li class="step ${i <= opts.current ? "step-primary" : ""}" ${ctx.fns.procs.ui.attr({ role: "step", status })}>${inner}</li>`;
    }).join("")}
</ul>`;
}
