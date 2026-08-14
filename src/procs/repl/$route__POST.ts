// POST /repl — server-side eval, and a first-class part of the framework rather
// than a debug hatch: this is how a running process is inspected and edited.
// ANYTHING posted here runs with ctx in scope, so it carries three gates and
// each covers what the others cannot:
//
//   the token     a JWT this run signs with its own key, `kind: "repl"`, kept in
//                 .runtime/repl-token (0600) — readable from this machine's
//                 filesystem and nowhere else. A proxy can forge headers; it
//                 cannot read a file, and it cannot sign one.
//   loopback      the socket peer must be local and not forwarded, so nothing
//                 reaches this from the network even with a leaked token.
//   production    NODE_ENV=production → 403 even from localhost
/**
 * Handle the POST request for the repl route.
 * @param opts.req The incoming HTTP request.
 */
export default async function (ctx: Context, session: Session, opts: { req: Request }) {
    const env = ctx.env ?? {};
    if (env.NODE_ENV === "production") return new Response("repl disabled", { status: 403 });

    // Loopback-only, and NOT through a proxy: a reverse proxy makes every request
    // look like 127.0.0.1, but always adds an `x-forwarded-*` header, so a
    // forwarded request is rejected — /repl stays reachable only from the box.
    const forwarded = opts.req.headers.get("x-forwarded-for") ?? opts.req.headers.get("x-forwarded-host");
    const ip = ctx.state.procs?.http?.server?.server?.requestIP?.(opts.req)?.address;
    if (forwarded || (ip && !isLoopback(ip))) {
        return new Response("repl is loopback-only", { status: 403 });
    }

    const header = opts.req.headers.get("authorization") ?? "";
    const given = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : new URL(opts.req.url).searchParams.get("token") ?? "";
    const claims = given ? await ctx.fns.procs.auth.verify({ token: given }) : null;
    if (claims?.kind !== "repl") {
        return new Response("repl needs this run's token — use `bun script/repl.ts` (it reads .runtime/repl-token)", { status: 403 });
    }

    const code = await opts.req.text();
    // Watcher's per-file error board: if any watched file failed to load,
    // every REPL response carries it — a stale fn can't silently pass for fresh.
    const errs: Map<string, string> | undefined = ctx.state.procs?.dev?.errors;
    const watchErrors = errs && errs.size > 0 ? Object.fromEntries(errs) : undefined;
    try {
        const result = await ctx.fns.procs.repl.eval({ code });
        return new Response(JSON.stringify({ success: true, output: result.output, return: result.return, ...(watchErrors && { watchErrors }) }), { status: 200 });
    } catch (error: any) {
        // A recognised failure carries what to do next — see `repl.explain`.
        const next = ctx.fns.procs.repl.explain({ error });
        return new Response(JSON.stringify({ error: error.message, ...(next && { next }), stack: error.stack, ...(watchErrors && { watchErrors }) }), { status: 500 });
    }
}

function isLoopback(addr: string): boolean {
    return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1" || addr === "localhost";
}
