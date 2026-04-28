import { basename, dirname } from "node:path";

const METHODS = new Set(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]);

export type ProjectEntry =
    | { kind: "fn"; rel: string; moduleDir: string; fileName: string; runtimeName: string }
    | { kind: "type"; rel: string; moduleDir: string; fileName: string; typeName: string }
    | { kind: "route"; rel: string; moduleDir: string; fileName: string; routePath: string; method: string }
    | { kind: "script"; rel: string; moduleDir: string; fileName: string; routePath: string }
    | { kind: "skip"; rel: string; moduleDir: string; fileName: string; reason: string };

export default function (rel: string): ProjectEntry {
    const moduleDir = dirname(rel);
    const fileName = basename(rel);

    if (/^\$script_.+\.(js|mjs|css)$/.test(fileName)) {
        const m = /^\$script_(.+?)(\.\w+)$/.exec(fileName);
        if (!m || !m[1] || !m[2]) return { kind: 'skip', rel, moduleDir, fileName, reason: 'bad-script-name' };
        const segs = moduleDir === '.' ? [] : moduleDir.split('/');
        return { kind: 'script', rel, moduleDir, fileName, routePath: '/' + [...segs, m[1] + m[2]].join('/') };
    }

    if (rel.endsWith('.d.ts')) return { kind: 'skip', rel, moduleDir, fileName, reason: 'dts' };
    if (rel.endsWith('.test.ts')) return { kind: 'skip', rel, moduleDir, fileName, reason: 'test' };
    if (rel.endsWith('.entry.ts')) return { kind: 'skip', rel, moduleDir, fileName, reason: 'entry' };
    if (!rel.endsWith('.ts')) return { kind: 'skip', rel, moduleDir, fileName, reason: 'non-ts' };

    const stem = basename(rel, '.ts');
    if (stem === '$main' || stem === '$test') return { kind: 'skip', rel, moduleDir, fileName, reason: 'reserved' };

    if (stem.startsWith('$type_')) {
        const typeName = stem.slice('$type_'.length);
        if (!typeName) return { kind: 'skip', rel, moduleDir, fileName, reason: 'bad-type-name' };
        return { kind: 'type', rel, moduleDir, fileName, typeName };
    }

    if (stem.startsWith('$route_')) {
        const rest = stem.slice('$route_'.length);
        const idx = rest.lastIndexOf('_');
        const pathRaw = idx === -1 ? '' : rest.slice(0, idx);
        const method = idx === -1 ? rest : rest.slice(idx + 1);
        if (!METHODS.has(method)) return { kind: 'skip', rel, moduleDir, fileName, reason: 'bad-route-method' };
        const pathParts = pathRaw === '' ? [] : pathRaw.split('_');
        const moduleSegments = moduleDir === '.' ? [] : moduleDir.split('/');
        const allSegments = [...moduleSegments, ...pathParts].filter(Boolean).map(s => s.startsWith('$') ? ':' + s.slice(1) : s);
        return { kind: 'route', rel, moduleDir, fileName, routePath: '/' + allSegments.join('/'), method };
    }

    const runtimeName = stem.startsWith('$') ? stem.slice(1) : stem;
    return { kind: 'fn', rel, moduleDir, fileName, runtimeName };
}
