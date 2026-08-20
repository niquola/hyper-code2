/** Clears the Hyper session cookie. */
export default function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const forwardedProto = opts.req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const cookieURL = forwardedProto === "https" ? "https://hyper.invalid/" : opts.req.url;
    const cookie = ctx.fns.procs.auth.cookie({ url: cookieURL });
    const json = (opts.req.headers.get("accept") ?? "").includes("application/json");
    return json ? Response.json({ ok: true }, { headers: { "set-cookie": cookie } }) : new Response(null, { status: 303, headers: { "set-cookie": cookie, location: "/auth/login" } });
}
