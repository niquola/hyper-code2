/**
 * Authenticates a privileged loopback external REPL request
 *
 * Rejects forwarded and non-loopback traffic and verifies the separate external-repl token before arbitrary runtime evaluation.
 * @param opts.req Incoming privileged REPL request.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Incoming privileged REPL request. */
        req: Request;
    },
): Promise<{ ok: true } | { ok: false; response: Response }> {
    const forwarded = opts.req.headers.get("x-forwarded-for") ?? opts.req.headers.get("x-forwarded-host");
        const ip = (ctx.state as any).procs?.http?.server?.server?.requestIP?.(opts.req)?.address;
    const loopback = ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || ip === "localhost";
        if (forwarded || !loopback) return { ok: false, response: Response.json({ error: "external REPL is loopback-only" }, { status: 403 }) };
        const header = opts.req.headers.get("authorization") ?? "";
        const token = header.startsWith("Bearer ") ? header.slice(7) : "";
        const claims = token ? await ctx.fns.procs.auth.verify({ token }) : null;
        if (claims?.kind !== "external-repl") return { ok: false, response: Response.json({ error: "external REPL needs its privileged token" }, { status: 403 }) };
        return { ok: true };
}
