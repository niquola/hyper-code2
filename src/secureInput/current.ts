/**
 * Returns metadata for the currently active transient secure-input prompt.
 */
export default function (ctx: Context, _session: Session | null, _opts: {}): Response {
    const secureState = (ctx.state as any).secureInput;
    const prompts: Map<string, any> | undefined = secureState?.prompts;
    const prompt = prompts?.values().next().value;
    // A browser asking after the closed event has dropped the old modal, so the
    // next prompt may open without racing the previous form.
    if (!prompt && secureState?.closing) delete secureState.closing;
    return new Response(prompt ? ctx.fns.secureInput.render({ prompt }) : '', { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
