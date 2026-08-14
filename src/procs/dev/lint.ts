// Lint the project's namespace structure. proc maps directories to nested
// ctx.fns namespaces, so two rules must hold or runtime / types / build
// silently diverge:
//   1. Every namespace segment, function name and type name is a valid JS
//      identifier. Non-identifier names (dash, dot, space) emit unquoted into
//      ctx_ns.d.ts and break the WHOLE file, and dots corrupt the build
//      manifest's dotted-key tree.
//   2. A name is EITHER a function OR a namespace, never both. A file x.ts
//      beside a dir x/ makes ctx.fns.<…>.x ambiguous: at runtime the injecting
//      Proxy wraps the function and drops the nested fns; the build silently
//      loses them; genTypes emits a duplicate member. Callable-namespaces
//      can't work with the Proxy, so we forbid the collision outright.
//
//   ctx.fns.procs.dev.lint({})  → { ok, errors }  (logs each error unless silent)
import { segments } from "../project/classify";
const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * Lint the dev subsystem operation.
 * @param opts.silent Whether to suppress console output.
 */
export default async function (ctx: Context, _session: Session | null, opts?: { silent?: boolean }) {
    const entries = await ctx.fns.procs.project.scan({});
    const errors: string[] = [];
    const fnPaths = new Set<string>();

    // A capital marks a type, so `note.ts` and `Note.ts` are different things —
    // and on a case-insensitive filesystem (macOS by default) they are the SAME
    // FILE. Two names that differ only in case are refused rather than silently
    // becoming one.
    const byLowerPath = new Map<string, string>();
    for (const e of entries) {
        if (e.kind === 'skip') continue;
        const key = (e.rel as string).toLowerCase();
        const seen = byLowerPath.get(key);
        if (seen && seen !== e.rel) errors.push(`name collision by case: src/${seen} vs src/${e.rel} — one file on a case-insensitive filesystem`);
        else byLowerPath.set(key, e.rel);
        // `$type_Name.ts` still loads, and is the escape hatch when `Name.ts`
        // would collide with a function of the same name on a case-insensitive
        // filesystem (`db/query.ts` + `Query`). Deprecated only where the plain
        // spelling is actually free.
        // Same story as `$type_`: state is a type, so it is named by its case
        // now — `<module>/State.ts` types ctx.state.<module>.
        if (e.fileName.startsWith('$state_')) errors.push(`deprecated: src/${e.rel} — a module's state is typed by src/${e.moduleDir}/State.ts now (ctx.state.${e.moduleDir.replaceAll('/', '.')})`);
        if (e.fileName.startsWith('$type_')) {
            const plain = `${e.moduleDir === '.' ? '' : e.moduleDir + '/'}${e.fileName.slice('$type_'.length)}`;
            if (!entries.some((o: any) => o.rel !== e.rel && o.rel.toLowerCase() === plain.toLowerCase()))
                errors.push(`deprecated: src/${e.rel} — a type is named by its case now (${e.fileName.slice('$type_'.length)}), run \`bun script/cli.ts migrate:types\``);
        }
    }

    for (const e of entries) {
        if (e.kind !== 'fn' && e.kind !== 'type') continue;
        const segs = segments(e.moduleDir);
        for (const s of segs) if (!IDENT.test(s)) errors.push(invalidNamespaceSegment(s, e));
        if (e.kind === 'fn') {
            if (!IDENT.test(e.runtimeName!)) errors.push(`invalid function name "${e.runtimeName}"  (src/${e.rel}) — must be a valid identifier`);
            fnPaths.add([...segs, e.runtimeName!].join('.'));
        } else if (!IDENT.test(e.typeName!)) {
            errors.push(`invalid type name "${e.typeName}"  (src/${e.rel}) — must be a valid identifier`);
        }
    }

    // The same rule, applied to state: `<module>/State.ts` types
    // ctx.state.<module>, so a module is EITHER a slot OR the parent of slots.
    // Both at once would need an intersection type and a runtime rule about not
    // replacing the slot; a module that wants its own state next to children can
    // put it in a child of its own.
    const stateModules = entries.filter((e: any) => e.kind === 'type' && e.typeName === 'State' && e.moduleDir !== '.').map((e: any) => e.moduleDir);
    for (const parent of stateModules) {
        for (const child of stateModules) {
            if (child !== parent && child.startsWith(parent + '/'))
                errors.push(`state collision: src/${parent}/State.ts and src/${child}/State.ts — ctx.state.${parent.replaceAll('/', '.')} cannot be both a slot and a parent of slots`);
        }
    }

    // A hook answers a point somebody declared. An answer to a point nobody
    // declares is a typo in the name, and the only way it shows up otherwise is
    // as silence — the handler simply never runs.
    const declared = entries.filter((e: any) => e.kind === 'point')
        .map((e: any) => ({ name: `${e.moduleDir.replaceAll('/', '.')}.${e.name}`, family: !!ctx.state.procs?.hooks?.points?.[`${e.moduleDir.replaceAll('/', '.')}.${e.name}`]?.family }));
    const answers = (name: string) => declared.some(p => p.name === name || (p.family && name.startsWith(p.name + ".")));
    for (const e of entries) {
        if (e.kind !== 'hook') continue;
        if (!answers(e.hookName!)) errors.push(`no such extension point: src/${e.rel} answers "${e.hookName}", which nobody declares (a module declares one with $point_<name>.ts)`);
    }

    // fn-vs-namespace collision: a fn whose dotted path is a prefix of another.
    for (const p of fnPaths) {
        for (const q of fnPaths) {
            if (p !== q && q.startsWith(p + '.')) {
                const f = p.replaceAll('.', '/');
                errors.push(`name collision: "${p}" is both a function and a namespace (src/${f}.ts vs src/${f}/…) — rename one`);
                break;
            }
        }
    }

    const uniq = [...new Set(errors)].sort();
    if (uniq.length && !opts?.silent) for (const e of uniq) console.error(`[lint] ✗ ${e}`);
    return { ok: uniq.length === 0, errors: uniq };
}

function invalidNamespaceSegment(segment: string, entry: any): string {
    const base = `invalid namespace segment "${segment}"  (src/${entry.rel}) — must be a valid identifier`;
    if (entry.kind === "fn" && segment.includes("-")) {
        return `${base}. This looks like a helper .ts file inside a kebab route folder. Kebab folders may contain $route_* files, but not plain helpers like page.ts/lib.ts. Move helper code to an identifier folder, e.g. src/pills/shared.ts or src/lib/pills.ts`;
    }
    return base;
}
