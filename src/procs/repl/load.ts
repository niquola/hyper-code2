// Hot-reload functions from disk into the running process.
//   ctx.fns.procs.repl.load({ name: "project.scan" })  → reload one fn
//   ctx.fns.procs.repl.load({ name: "project" })       → reload whole module
//   ctx.fns.procs.repl.load({ name: "genTypes" })      → reload a root $name.ts fn
import { bindSelf, setPath, source } from "../boot/load";

/**
 * Load the repl subsystem operation.
 * @param opts.name The target name.
 */
export default async function (ctx: Context, _session: Session | null, opts: { name: string }) {
    const target = opts.name;

    const entries = await ctx.fns.procs.project.scan({});

    if (target.includes('.')) {
        const segs = target.split('.');
        const fnName = segs.pop()!;
        const modPath = segs.join('/');
        await loadFile(ctx, modPath, fnName);
        scheduleDocsIndex(ctx);
        return { reloaded: target };
    }

    const loaded: string[] = [];
    for (const entry of entries) {
        if (entry.kind !== 'fn') continue;
        if (entry.moduleDir !== target) continue;
        await loadFile(ctx, target, entry.runtimeName!);
        if (!loaded.includes(entry.runtimeName!)) loaded.push(entry.runtimeName!);
    }
    scheduleDocsIndex(ctx);
    return { reloaded: target, count: loaded.length, fns: loaded };
}

function scheduleDocsIndex(ctx: Context): void {
    if (!(ctx.fns as any).runtime?.docs?.index) return;
    queueMicrotask(() => (ctx.fns as any).runtime.docs.index({}).catch((error: any) =>
        ctx.fns.procs.log.warn({ event: "runtime.docs.index.failed", msg: String(error?.message ?? error) })));
}


async function loadFile(ctx: Context, modPath: string, fnName: string) {
    // Look the fn up by its dotted registry path in the scan (which knows the
    // real abs path) — works for src AND module files (which live outside src/).
    const entries = await ctx.fns.procs.project.scan({});
    const e = entries.find((x: any) => x.kind === 'fn' && x.moduleDir === modPath && x.runtimeName === fnName);
    if (!e) throw new Error(`no file for ${modPath}/${fnName}`);
    const m = await import((e as any).abs + `?t=${Date.now()}`);
    const fn = m.default;
    if (typeof fn !== 'function') throw new Error(`${(e as any).rel}: no default function export`);
    // Raw fns live in ctx.state.registry (ctx.fns is the injecting Proxy), and a
    // module's fn keeps seeing itself as `app` after a reload too.
    // Through the fn loader, so a hot-swapped function carries the same
    // metadata (name, module, file, docstring) a booted one does.
    const load = (ctx.state as any).procs?.boot?.loaders?.fn;
    if (load) await load(ctx, null, { entries: [{ ...(e as any), fn }] });
    else setPath(ctx.state.registry, [...modPath.split('/'), fnName], bindSelf(fn, (e as any).namespace));
    ctx.fns.procs.log.info({ event: "reload.fn", msg: `${modPath.replaceAll('/', '.')}.${fnName}`, from: source(e as any) });
}
