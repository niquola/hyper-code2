// A control that does something, and therefore one that carries `data-action` —
// the verb, not the label, so `page.click({ action: "materialize" })` keeps
// working when the wording changes. Give it the `entity`/`id` it acts on and the
// same descriptor addresses it from anywhere on the page.
//
// `post`/`get` wire it to htmx; without either it is a plain button for a form
// to submit or for client.js to handle.
// daisyUI's `btn`. `default` is the quiet outline one a toolbar is full of;
// `primary` is the one action a screen is actually about.
const TONE = {
    default: "btn-outline", primary: "btn-primary", danger: "btn-error btn-outline",
    ghost: "btn-ghost", success: "btn-success", warning: "btn-warning", neutral: "btn-neutral",
} as const;

/**
 * Perform button for the ui subsystem.
 * @param opts.action The action URL.
 * @param opts.label The display label.
 * @param opts.entity The entity value used by the operation.
 * @param opts.id The target identifier.
 * @param opts.post The post value used by the operation.
 * @param opts.get The get value used by the operation.
 * @param opts.vals The vals value used by the operation.
 * @param opts.target The operation target.
 * @param opts.tone The tone value used by the operation.
 * @param opts.title The display title.
 * @param opts.disabled The disabled value used by the operation.
 * @param opts.name The target name.
 * @param opts.value The value to apply.
 */
export default function (ctx: Context, _session: Session | null, opts: {
    action: string; label: string; entity?: string; id?: string;
    post?: string; get?: string; vals?: Record<string, any>; target?: string;
    tone?: keyof typeof TONE; title?: string; disabled?: boolean; name?: string; value?: string;
}): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const hx = opts.post ? `hx-post="${esc(opts.post)}"` : opts.get ? `hx-get="${esc(opts.get)}"` : "";
    const vals = opts.vals ? ` hx-vals="${esc(JSON.stringify(opts.vals))}"` : "";
    const target = hx ? ` hx-target="${esc(opts.target ?? "#main")}" hx-swap="innerHTML"` : "";
    // `name` makes it a submit that says which button was pressed — how a Back or
    // a Save-draft beside a form is told apart from its Submit.
    const kind = opts.name ? ` type="submit" name="${esc(opts.name)}" value="${esc(opts.value ?? "1")}"` : "";

    return `<button${kind} class="btn btn-sm ${TONE[opts.tone ?? "default"]}" ${ctx.fns.procs.ui.attr({ action: opts.action, entity: opts.entity, id: opts.id })}${opts.title ? ` title="${esc(opts.title)}"` : ""}${opts.disabled ? " disabled" : ""} ${hx}${vals}${target}>${esc(opts.label)}</button>`;
}
