// HTMX fragment endpoint. On page load it restores the active modal; when no
// prompt is active it returns an empty host body.
export default function (ctx: Context, _session: Session | null, _opts: { req: Request }) {
    const prompts: Map<string, any> | undefined = (ctx.state as any).secureInput?.prompts;
    const prompt = prompts?.values().next().value;
    const html = prompt ? ctx.fns.secureInput.render({ prompt }) : '';
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
