/**
 * Authenticates a loopback external-harness request
 *
 * Checks loopback origin, rejects forwarded traffic, and verifies the scoped external-harness token before an external API operation.
 * @param opts.req Incoming request to authenticate.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Incoming request to authenticate. */
        req: Request;
    },
): Promise<{ ok: true } | { ok: false; response: Response }> {
    const forwarded = opts.req.headers.get("x-forwarded-for") ?? opts.req.headers.get("x-forwarded-host");
        const ip = (ctx.state as any).procs?.http?.server?.server?.requestIP?.(opts.req)?.address;
    const loopback = ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || ip === "localhost";
        if (forwarded || !loopback) return { ok: false, response: Response.json({ error: "external gateway is loopback-only" }, { status: 403 }) };
        const header = opts.req.headers.get("authorization") ?? "";
        const token = header.startsWith("Bearer ") ? header.slice(7) : "";
        const claims = token ? await ctx.fns.procs.auth.verify({ token }) : null;
        if (claims?.kind !== "external-harness") return { ok: false, response: Response.json({ error: "external gateway needs its scoped token" }, { status: 403 }) };
        return { ok: true };
}
