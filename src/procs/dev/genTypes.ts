// Generate src/ctx_ns.d.ts from the project scan. The registry nests by
// directory (src/a/b/c.ts → ctx.fns.a.b.c), so types must nest too — we build
// a tree from moduleDir segments and emit nested interface bodies (fns) and
// nested `namespace` blocks (types). Each fn type is wrapped in Injected<> —
// ctx/session stripped, matching the real call shape.
import { relative, resolve } from "node:path";

type Node = { fns: Record<string, string>; types: Record<string, string>; children: Record<string, Node> };
const makeNode = (): Node => ({ fns: {}, types: {}, children: {} });
const hasFns = (n: Node): boolean => Object.keys(n.fns).length > 0 || Object.values(n.children).some(hasFns);
const hasTypes = (n: Node): boolean => Object.keys(n.types).length > 0 || Object.values(n.children).some(hasTypes);
// Defense-in-depth: dev.lint forbids non-identifier names, but if one slips in
// (hand-edited file before lint runs), quote FnsRegistry member keys so a single
// bad name doesn't break the whole d.ts. Namespaces/type-aliases can't be quoted.
const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const k = (s: string): string => IDENT.test(s) ? s : JSON.stringify(s);

/**
 * Generate gen types for the dev subsystem.
 */
export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    const srcDir = resolve(ctx.fns.procs.project.projectRoot({}), "src"); // app's src (where ctx_ns.d.ts lives)
    const entries = await ctx.fns.procs.project.scan({});

    const globals: string[] = [];   // root Name.ts
    const stateSlots: string[] = [];        // legacy $state_<key>.ts → ctx.state.<key>
    const stateOf = new Map<string, string>();   // <module> → its State.ts, for ctx.state.<module>
    const sessionParts: string[] = [];      // <module>/Session.ts → merged into Session
    let baseSession = "";                   // the framework's own Session.ts (src root)
    const root = makeNode();
    const moduleDirs = new Set<string>();
    let typeCount = 0;

    const walk = (segments: string[]): Node => {
        let n = root;
        for (const s of segments) n = (n.children[s] ??= makeNode());
        return n;
    };

    for (const entry of entries) {
        if (entry.kind !== 'fn' && entry.kind !== 'type' && entry.kind !== 'state') continue;
        // Import path is relative to src/ (where ctx_ns.d.ts lives), from the
        // REAL file (entry.abs) — so module files outside src/ resolve too.
        let importPath = relative(srcDir, entry.abs).replace(/\.ts$/, '');
        if (!importPath.startsWith('.')) importPath = './' + importPath;
        if (entry.kind === 'state') {
            // The file exports `type <key>`; it types ctx.state.<key>.
            stateSlots.push(`        ${entry.stateKey!}: import("${importPath}").${entry.stateKey};`);
        } else if (entry.kind === 'type') {
            typeCount++;
            // Two type names mean something beyond themselves. `State` in a module
            // types that module's slot — ctx.state.<module> — and `Session` adds
            // its fields to the one session every call carries. Both still live in
            // `types.<module>.*` like any other type.
            if (entry.typeName === 'State' && entry.moduleDir !== '.') stateOf.set(entry.moduleDir, importPath);
            if (entry.typeName === 'Session' && entry.moduleDir !== '.') sessionParts.push(`types.${entry.moduleDir.replaceAll('/', '.')}.Session`);
            if (entry.moduleDir === '.') {
                // The root Session.ts is the base every contribution extends, so it
                // is not emitted as the global `Session` — the assembled one is.
                if (entry.typeName === 'Session') { baseSession = importPath; continue; }
                globals.push(`    type ${entry.typeName} = import("${importPath}").${entry.typeName};`);
            }
            else walk(entry.moduleDir.split('/')).types[entry.typeName!] = importPath;
        } else {
            { walk(entry.moduleDir.split('/')).fns[entry.runtimeName!] = importPath; moduleDirs.add(entry.moduleDir); }
        }
    }

    const emitFns = (node: Node, ind: string): string[] => {
        const out: string[] = [];
        for (const name of Object.keys(node.fns).sort())
            out.push(`${ind}${k(name)}: Injected<typeof import("${node.fns[name]}").default>;`);
        for (const seg of Object.keys(node.children).sort()) {
            const child = node.children[seg]!;
            if (!hasFns(child)) continue;
            out.push(`${ind}${k(seg)}: {`, ...emitFns(child, ind + '    '), `${ind}};`);
        }
        return out;
    };
    const emitTypes = (node: Node, ind: string): string[] => {
        const out: string[] = [];
        for (const name of Object.keys(node.types).sort()) {
            if (!IDENT.test(name)) { console.warn(`[genTypes] skip non-identifier type "${name}"`); continue; }
            out.push(`${ind}type ${name} = import("${node.types[name]}").${name};`);
        }
        for (const seg of Object.keys(node.children).sort()) {
            const child = node.children[seg]!;
            if (!hasTypes(child)) continue;
            if (!IDENT.test(seg)) { console.warn(`[genTypes] skip non-identifier namespace "${seg}"`); continue; }
            out.push(`${ind}namespace ${seg} {`, ...emitTypes(child, ind + '    '), `${ind}}`);
        }
        return out;
    };

    // ctx.state.<module>, nested the way names nest. A module is either a slot
    // or the parent of slots, never both (dev.lint refuses it), so the tree is
    // unambiguous: no intersections, and nothing to clobber.
    const emitState = (prefix: string[], ind: string): string[] => {
        const out: string[] = [];
        const own = stateOf.get(prefix.join('/'));
        if (own) return out;                                   // a leaf: handled by its parent
        const kids = [...stateOf.keys()]
            .filter(m => prefix.length === 0 ? true : m.startsWith(prefix.join('/') + '/'))
            .map(m => m.split('/')[prefix.length]!)
            .filter(Boolean);
        for (const seg of [...new Set(kids)].sort()) {
            const path = [...prefix, seg];
            const leaf = stateOf.get(path.join('/'));
            if (leaf) out.push(`${ind}${k(seg)}: import("${leaf}").State;`);
            else out.push(`${ind}${k(seg)}: {`, ...emitState(path, ind + '    '), `${ind}};`);
        }
        return out;
    };
    const stateLines = [...stateSlots.sort(), ...emitState([], '        ')];

    const lines: string[] = [
        '// Auto-generated by ctx.genTypes — do not edit',
        '// Injected<F> strips (ctx, session) — they are injected by the ctx.fns Proxy.',
        'type Injected<F> = F extends (ctx: any, session: any, ...args: infer A) => infer R ? (...args: A) => R : never;',
        '',
        'declare global {',
        ...globals.sort(), // deterministic order, like every other section (avoids d.ts churn)
        '',
        '    interface FnsRegistry {',
        ...emitFns(root, '        '),
        '    }',
    ];
    if (hasTypes(root)) {
        lines.push('', '    namespace types {', ...emitTypes(root, '        '), '    }');
    }
    if (stateLines.length) {
        // Merges into the CtxState interface in Context.ts → typed ctx.state.<module>.
        lines.push('', '    interface CtxState {', ...stateLines, '    }');
    }
    // One session, assembled: the framework's base plus every module's
    // contribution. A module adds fields by shipping `Session.ts`; nobody
    // overrides the type, so nothing is lost when two modules both want in.
    if (baseSession) {
        // An intersection, not an interface: the base carries an index signature
        // (a session is extensible at runtime), and `&` keeps it.
        const parts = [`import("${baseSession}").Session`, ...sessionParts.sort()];
        lines.push('', `    type Session = ${parts.join(' & ')};`);
    }
    lines.push('}', 'export {};', '');

    const out = srcDir + '/ctx_ns.d.ts';
    await Bun.write(out, lines.join('\n'));
    ctx.fns.procs.log.info({ event: "types.generated", msg: `${moduleDirs.size} modules, ${typeCount} types → src/ctx_ns.d.ts`, modules: moduleDirs.size, types: typeCount, state: stateLines.length, session: sessionParts.length });
    return { modules: moduleDirs.size, types: typeCount, state: stateLines.length, session: sessionParts.length };
}
