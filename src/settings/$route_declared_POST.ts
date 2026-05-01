// Submit handler for the declared-settings form.
// Iterates form fields, calls settings.set per declared key (or settings.remove
// when the user clicked the per-row "reset" button). Returns the freshly-rendered
// form for an htmx outerHTML swap.
function parseForType(raw: string, type?: string): any {
    if (type === 'number')  return Number(raw);
    if (type === 'boolean') return raw === 'true' || raw === '1';
    return raw;
}

export default async function (ctx: Context, _session: any, req: Request) {
    const fd = await req.formData();
    const registry: Map<string, any> | undefined = (ctx.state as any).settingsRegistry;

    if (registry) {
        const resetTarget = fd.get('reset');
        if (typeof resetTarget === 'string' && resetTarget) {
            const dotIdx = resetTarget.indexOf('.');
            if (dotIdx > 0) {
                ctx.fns.settings.remove(ctx, {
                    module: resetTarget.slice(0, dotIdx),
                    scopeType: 'global',
                    key: resetTarget.slice(dotIdx + 1),
                });
            }
        } else {
            for (const [regKey, descriptor] of registry.entries()) {
                const dotIdx = regKey.indexOf('.');
                if (dotIdx <= 0) continue;
                const module = regKey.slice(0, dotIdx);
                const key = regKey.slice(dotIdx + 1);

                const raw = fd.get(regKey);
                let value: any;
                if (descriptor.type === 'boolean') {
                    value = raw === 'true' || raw === '1' || raw === 'on';
                } else if (raw == null) {
                    continue;
                } else if (descriptor.type === 'secret' && raw === '') {
                    // Empty secret field = leave as-is.
                    continue;
                } else {
                    value = parseForType(String(raw), descriptor.type);
                    if (descriptor.type === 'enum' && Array.isArray(descriptor.options)
                        && !descriptor.options.includes(value)) continue;
                    if (descriptor.type === 'number' && !Number.isFinite(value)) continue;
                }

                // Skip writes that match what get() resolves to right now — keeps DB sparse.
                const current = ctx.fns.settings.get(ctx, { module, scopeType: 'global', key });
                if (Object.is(current, value)) continue;

                ctx.fns.settings.set(ctx, {
                    module, scopeType: 'global', key, value,
                    isSecret: descriptor.type === 'secret',
                });
            }
        }
    }

    return new Response(ctx.fns.settings.renderDeclaredForm(ctx), {
        headers: { 'content-type': 'text/html; charset=utf-8' },
    });
}
