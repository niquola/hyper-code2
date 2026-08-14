/**
 * Returns metadata for the currently active transient secure-input prompt.
 */
export default function (ctx: Context, _session: Session | null, _opts: {}): Response {
    const prompts: Map<string, any> | undefined = (ctx.state as any).secureInput?.prompts;
    const prompt = prompts?.values().next().value;
    return new Response(prompt ? ctx.fns.secureInput.render({ prompt }) : '', { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
