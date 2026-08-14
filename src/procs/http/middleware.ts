// Middleware whose path prefix matches `pathname`, in run order (most general
// first). A prefix segment `:x` is a one-segment wildcard. Used by http/$start
// and http/dispatch to run middleware before the route handler.
/**
 * Perform middleware for the http subsystem.
 * @param opts.pathname The pathname value used by the operation.
 */
export default function (ctx: Context, _session: Session | null, opts: { pathname: string }) {
    const all = ctx.state.procs?.http.middleware ?? [];
    const path = opts.pathname.split('/').filter(Boolean);
    return all.filter((mw: any) => prefixMatches(mw.segs, path));
}

function prefixMatches(prefix: string[], path: string[]): boolean {
    if (prefix.length > path.length) return false;
    for (let i = 0; i < prefix.length; i++) {
        const p = prefix[i]!;
        if (p.startsWith(':')) continue; // wildcard one segment
        if (p !== path[i]) return false;
    }
    return true;
}
