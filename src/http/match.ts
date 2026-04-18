export default function (
    routes: Record<string, Record<string, Function>>,
    method: string,
    pathname: string,
): { handler: Function; params: Record<string, string> } | null {
    const exact = routes[pathname];
    if (exact && exact[method]) return { handler: exact[method], params: {} };

    const urlSegs = pathname.split("/").filter(Boolean);
    for (const [pattern, methods] of Object.entries(routes)) {
        const h = methods[method];
        if (!h) continue;
        const patSegs = pattern.split("/").filter(Boolean);
        if (patSegs.length !== urlSegs.length) continue;
        const params: Record<string, string> = {};
        let ok = true;
        for (let i = 0; i < patSegs.length; i++) {
            const p = patSegs[i]!;
            const u = urlSegs[i]!;
            if (p.startsWith(":")) {
                params[p.slice(1)] = u;
            } else if (p !== u) {
                ok = false;
                break;
            }
        }
        if (ok) return { handler: h, params };
    }
    return null;
}
