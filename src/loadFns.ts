// Scan src/ and .hyper/ for function files and register them on ctx.
export default async function (ctx: Context): Promise<void> {
    const entries = await ctx.fns.project.scan(ctx);
    for (const entry of entries) {
        if (entry.kind !== 'fn') continue;
        const mod = await import(entry.abs + `?t=${Date.now()}`);
        const fn = mod.default;
        if (typeof fn !== 'function') continue;
        const fnName = entry.runtimeName;
        const label = entry.root;
        if (entry.moduleDir === '.') {
            (ctx as any)[fnName] = fn;
            console.log(`[fns] ctx.${fnName}  ←  ${label}/${entry.rel}`);
        } else {
            const segments = entry.moduleDir.split('/');
            let target: any = ctx.fns;
            for (const seg of segments) {
                target[seg] = target[seg] || {};
                target = target[seg];
            }
            target[fnName] = fn;
            console.log(`[fns] ctx.fns.${segments.join('.')}.${fnName}  ←  ${label}/${entry.rel}`);
        }
    }
}
