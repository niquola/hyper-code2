/** Render a trigger that opens server-provided popup content. */
export default function (ctx: Context, _session: Session | null, opts: {
    /** RPC method name. */ method: string;
    /** Route parameters captured from the request path. */ params?: Record<string, any>;
    /** Trusted component-owned trigger HTML. */ html: string;
    /** Additional safe HTML attributes. */ attrs?: string;
    /** Shared button tone. */ tone?: "default" | "primary" | "danger" | "ghost" | "success" | "warning" | "neutral";
    /** Shared button size. @default "sm" */ size?: "xs" | "sm";
}): string {
    const attrs: Record<string, string | boolean> = {
        'hx-popup': opts.method,
        'hx-popup-params': JSON.stringify(opts.params ?? {}),
    };
    for (const match of String(opts.attrs ?? '').matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) {
        const name = match[1];
        if (name) attrs[name] = match[2] ?? true;
    }
    // `class`, `title` and `aria-label` are first-class button options, not raw attrs.
    const className = typeof attrs.class === 'string' ? attrs.class : undefined;
    const title = typeof attrs.title === 'string' ? attrs.title : undefined;
    const ariaLabel = typeof attrs['aria-label'] === 'string' ? attrs['aria-label'] : undefined;
    delete attrs.class;
    delete attrs.title;
    delete attrs['aria-label'];
    return ctx.fns.procs.ui.button({ action: 'open-popup', html: opts.html, tone: opts.tone, size: opts.size, appearance: opts.tone ? 'button' : 'plain', class: className, title, ariaLabel, attrs });
}
