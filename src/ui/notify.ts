export default async function (ctx: Context, opts: { message: string; level?: 'info' | 'warn' | 'error'; html?: string }) {
    const event = { type: 'ui.notify', level: opts.level ?? 'info', message: opts.message, html: opts.html ?? null };
    ctx.fns.events.emit(ctx, { event });
    return event;
}
