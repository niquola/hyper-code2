async function roots(ctx: Context) {
    return ctx.fns.project.roots(ctx);
}

export default async function (ctx: Context, opts: { name: string }) {
    const target = opts.name;
    if (target.includes('.')) {
        const segs = target.split('.');
        const fnName = segs.pop()!;
        const modPath = segs.join('/');
        await loadFile(ctx, modPath, fnName);
        return { reloaded: target };
    }

    const entries = await ctx.fns.project.scan(ctx);
    const loaded: string[] = [];
    for (const entry of entries) {
        if (entry.kind === 'setting' && entry.settingModule === target) {
            const m = await import((entry as any).abs + `?t=${Date.now()}`);
            const desc = m.default;
            if (desc && typeof desc === 'object') {
                const regKey = `${entry.settingModule}.${entry.settingKey}`;
                ((ctx.state as any).settingsRegistry ??= new Map()).set(regKey, desc);
                loaded.push(`$setting_${entry.settingKey}`);
            }
            continue;
        }
        if (entry.kind !== 'fn') continue;
        if (entry.moduleDir !== target) continue;
        await loadFile(ctx, target, entry.runtimeName);
        if (!loaded.includes(entry.runtimeName)) loaded.push(entry.runtimeName);
    }
    return { reloaded: target, count: loaded.length, fns: loaded };
}

async function loadFile(ctx: Context, modPath: string, fnName: string) {
    const candidates = [modPath + '/' + fnName + '.ts', modPath + '/$' + fnName + '.ts'];
    for (const root of await roots(ctx)) {
        for (const rel of candidates) {
            const abs = root.dir + '/' + rel;
            if (!(await Bun.file(abs).exists())) continue;
            const m = await import(abs + `?t=${Date.now()}`);
            const fn = m.default;
            if (typeof fn !== 'function') throw new Error(`${rel}: no default function export`);
            const segs = modPath.split('/');
            let tgt: any = ctx.fns;
            for (const seg of segs) {
                tgt[seg] = tgt[seg] || {};
                tgt = tgt[seg];
            }
            tgt[fnName] = fn;
            const label = root.name;
            console.log(`[reload] ctx.fns.${segs.join('.')}.${fnName}  ←  ${label}/${rel}`);
            return;
        }
    }
    throw new Error(`no file for ${modPath}/${fnName}`);
}
