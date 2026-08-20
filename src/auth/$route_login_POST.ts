/** Authenticates a password and issues the signed Hyper session cookie. */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const contentType = opts.req.headers.get("content-type") ?? "";
    let password = "", next = "/";
    if (contentType.includes("application/json")) {
        const body: any = await opts.req.json().catch(() => ({}));
        password = typeof body.password === "string" ? body.password : "";
        next = typeof body.next === "string" ? body.next : "/";
    } else {
        const form = await opts.req.formData();
        password = String(form.get("password") ?? "");
        next = String(form.get("next") ?? "/");
    }
    if (!(await ctx.fns.auth.checkPassword({ password }))) {
        await Bun.sleep(250);
        return contentType.includes("application/json")
            ? Response.json({ error: "invalid_password", message: "Invalid password" }, { status: 401 })
            : new Response("Invalid password", { status: 401, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
    if (!next.startsWith("/") || next.startsWith("//")) next = "/";
    const token = await ctx.fns.procs.auth.sign({ sub: "password-user", name: "Hyper user", role: "owner", days: 30 });
    const forwardedProto = opts.req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const cookieURL = forwardedProto === "https" ? "https://hyper.invalid/" : opts.req.url;
    const cookie = ctx.fns.procs.auth.cookie({ token, url: cookieURL, days: 30 });
    const headers = { "set-cookie": cookie, "cache-control": "no-store" };
    return contentType.includes("application/json")
        ? Response.json({ ok: true, user: { name: "Hyper user", role: "owner" } }, { headers })
        : new Response(null, { status: 303, headers: { ...headers, location: next } });
}
