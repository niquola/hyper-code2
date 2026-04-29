export default async function (ctx: Context, payload: { text: string; level?: 'info' | 'warn' | 'error'; html?: string }) {
    const event = { type: 'ui.notify', level: payload.level ?? 'info', text: payload.text, html: payload.html ?? null };
    ctx.fns.events.emit(ctx, event);
    return event;
}
