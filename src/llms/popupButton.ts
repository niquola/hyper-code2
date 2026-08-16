// Popup-local adapter over the shared procs.ui.button primitive. Keeping this
// tiny wrapper means no popup invents foreground/background classes again.
/** Renders a theme-safe shared button for LLM popups. */
/**
 * Render a shared UI button suitable for a popup form.
 * @param opts.action Stable semantic action name.
 * @param opts.label Visible button label.
 * @param opts.tone Shared button tone.
 * @param opts.class Additional layout classes, never colour classes.
 * @param opts.type Submit or plain button.
 */
export default function (ctx: Context, _session: Session | null, opts: {
    /** Stable semantic action name. */ action: string;
    /** Visible label. */ label: string;
    /** Shared component tone. @default "default" */ tone?: "default" | "primary" | "danger" | "ghost" | "success" | "warning" | "neutral";
    /** Additional layout-only classes. */ class?: string;
    /** Button type. @default "submit" */ type?: "submit" | "button";
}): string {
    const html = ctx.fns.procs.ui.button({ action: opts.action, label: opts.label, tone: opts.tone ?? "default", name: opts.type === "button" ? undefined : "submit", value: "1" });
    return opts.class ? html.replace('class="', `class="${opts.class} `) : html;
}
