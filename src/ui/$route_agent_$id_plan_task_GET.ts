export default function (ctx: Context, _session: Session | null, opts: { params: Record<string, string> }) {
    const id = `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    return new Response(ctx.fns.ui.planTaskRow({ task: { id, title: '', instructions: '', status: 'pending', elapsedMs: 0 }, autofocus: true }), {
        headers: { 'content-type': 'text/html; charset=utf-8' },
    });
}
