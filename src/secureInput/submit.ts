export default function (ctx: Context, _session: Session | null, opts: { id: string; value?: string; cancel?: string | boolean }): Response {
    const id = String(opts.id ?? '');
    const prompt = (ctx.state as any).secureInput?.prompts?.get(id);
    if (!prompt) return new Response('');
    if (opts.cancel) {
        (ctx.state as any).secureInput.prompts.delete(id);
        prompt.reject(new Error('transient input prompt cancelled'));
        return new Response('');
    }
    let value = String(opts.value ?? '');
    if (prompt.kind !== 'password') value = value.trim();
    if (!value) return new Response(ctx.fns.secureInput.render({ prompt, error: 'Value is required' }), { status: 200 });
    if (prompt.kind === 'otp' && !/^[0-9 -]{3,16}$/.test(value)) return new Response(ctx.fns.secureInput.render({ prompt, error: 'Enter the numeric code' }), { status: 200 });
    (ctx.state as any).secureInput.prompts.delete(id);
    prompt.resolve(prompt.kind === 'otp' ? value.replace(/[ -]/g, '') : value);
    return new Response('');
}
